import { Event } from '@surikat/core-domain';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'uuid';
import Aggregate, { BaseState } from './Aggregate';
import { AggregateFactory, defaultFactoryCreator } from './defaultFactoryCreator';

const LOG = LoggerFactory.getLogger('demeine:repository');

export interface Callback<Result = unknown> {
  (error: null, result: Result): void;
  (error: Error): void;
}

export interface Commit<Events = unknown> {
  id: string;
  partitionId: string;
  streamId: string;
  events: Array<Event<Events>>;
  commitSequence: number;
  isDispatched: string;
}

export interface ConcurrencyStrategy {
  <Types = unknown>(events: Array<Event<Types>>, streamEvents?: Array<Event<Types>>): boolean;
}

export interface RepositoryOptions {
  resetSnapshotOnFail?: boolean;
}

export interface Partition<State extends BaseState = BaseState, Events = unknown> {
  openStream(id: string, writeOnly?: boolean): Promise<Stream<Events>>;
  queryStream(id: string, version?: number, callback?: Callback): Promise<Array<Commit<Events>>>;
  loadSnapshot?(id: string): Promise<Snapshot<State> | undefined>;
  queryStreamWithSnapshot?(id: string): Promise<SnapshotStream<State>>;
  removeSnapshot?(id: string): Promise<Snapshot<State>>;
  storeSnapshot?(id: string, snapshot: Snapshot<State>, version: number): Promise<Snapshot<State>>;
}

export interface Snapshot<State extends BaseState = BaseState> {
  id: string;
  version?: number;
  snapshot?: State;
}

export interface SnapshotStream<State extends BaseState = BaseState> {
  commits?: Array<Commit<unknown>>;
  snapshot?: Snapshot<State>;
}

export interface Stream<Types = unknown> {
  _version: number;
  append(event: Event<Types>): void;
  commit(id: string): Promise<void>;
  getCommittedEvents(): Array<Event<Types>>;
  getVersion(): number;
}

export class Repository<SpecializedAggregate extends Aggregate = Aggregate<BaseState>, State extends BaseState = SpecializedAggregate['_state']> {
  private readonly aggregateType: string;
  private readonly concurrencyStrategy?: ConcurrencyStrategy;
  private readonly factory: AggregateFactory<SpecializedAggregate>;
  private readonly optimizeWrites: boolean;
  private readonly partition: Partition<State>;
  private readonly resetSnapshotOnFail: boolean;

  constructor(
    partition: Partition<State>,
    aggregateType: string,
    factory?: AggregateFactory<SpecializedAggregate>,
    concurrencyStrategy?: ConcurrencyStrategy,
    options: RepositoryOptions = {}
  ) {
    this.partition = partition;
    this.factory = factory ?? (defaultFactoryCreator(aggregateType) as AggregateFactory<SpecializedAggregate>); // TODO: How to handle optional type?
    this.aggregateType = aggregateType;
    this.concurrencyStrategy = concurrencyStrategy;

    this.resetSnapshotOnFail = options.resetSnapshotOnFail ?? true;
    this.optimizeWrites = options.resetSnapshotOnFail ?? true; // leaving this option true will not read the entire stream, at the cost of not being able to supply all committed events to the concurrencyStrategy.
  }

  checkConcurrencyStrategy = async <Events = unknown>(
    aggregate: SpecializedAggregate,
    stream: Stream,
    uncommittedEvents: Array<Event<Events>>
  ): Promise<boolean> => {
    const isNewStream = stream._version === -1;
    let shouldThrow = false;

    if (isNewStream || !this.concurrencyStrategy) {
      return shouldThrow;
    }

    const numberOfEvents = uncommittedEvents.length;
    const nextStreamVersion = stream._version + numberOfEvents;

    if (!(nextStreamVersion > aggregate._version)) {
      return shouldThrow;
    }

    const writeOnly = this.concurrencyStrategy?.length < 2 ?? true;

    if (writeOnly) {
      shouldThrow = this.concurrencyStrategy?.(uncommittedEvents);
      return shouldThrow;
    }

    const newStream = await this.partition.openStream(aggregate.id, false);
    shouldThrow = this.concurrencyStrategy(uncommittedEvents, newStream.getCommittedEvents());
    return shouldThrow;
  };

  findById = async (id: string, callback?: Callback<SpecializedAggregate>): Promise<SpecializedAggregate> => {
    LOG.info('%s findById(%s)', this.aggregateType, id);

    if (this.partition.queryStreamWithSnapshot !== undefined) {
      return this.findByQueryStreamWithSnapshot(id, false, callback);
    } else if (this.partition.loadSnapshot !== undefined) {
      return this.findBySnapshot(id, false, callback);
    }

    const aggregate = this.factory(id);
    const stream = await this.partition.openStream(id);
    const events = stream.getCommittedEvents();
    const version = stream.getVersion();
    aggregate._rehydrate(events, version);

    callback?.(null, aggregate);
    return aggregate;
  };

  findEventsById = async (id: string, callback?: Callback<Array<Event<unknown>>>): Promise<Array<Event<unknown>>> => {
    LOG.info('%s findEventsById(%s)', this.aggregateType, id);

    const stream = await this.partition.openStream(id);
    const events = stream.getCommittedEvents();

    callback?.(null, events);
    return events;
  };

  save = async (aggregate: SpecializedAggregate, commitId?: string, callback?: Callback<SpecializedAggregate>): Promise<SpecializedAggregate> => {
    const stream = await this.partition.openStream(aggregate.id, this.optimizeWrites);
    const uncommittedEvents = await aggregate.getUncommittedEventsAsync();

    const startAggregateVersion = aggregate.getVersion() - uncommittedEvents.length;
    const startStreamVersion = stream._version;
    const shouldThrow = await this.checkConcurrencyStrategy(aggregate, stream, uncommittedEvents);

    if (shouldThrow) {
      throw new Error('Concurrency error. Version mismatch on stream');
    }

    aggregate.clearUncommittedEvents();
    const savingWithId = commitId ?? uuid();

    uncommittedEvents.forEach((event) => {
      LOG.debug('%s append event - %s', this.aggregateType, event.id);
      stream.append(event);
    });

    try {
      await stream.commit(savingWithId);
      LOG.info('Aggregate: %s committed %d events with id: %s', this.aggregateType, uncommittedEvents.length, savingWithId);

      if (this.partition.storeSnapshot !== undefined && aggregate.getSnapshot) {
        LOG.debug('Persisting snapshot for stream %s version %s', aggregate.id, aggregate.getVersion());

        if (startStreamVersion > startAggregateVersion) {
          LOG.warn(
            'IGNORING SNAPSHOT STORE. VERSION MISMATCH MIGHT LEAD TO SNAPSHOT FAILURE. for stream %s version %s - start stream version: %s - start aggregate version: %s',
            aggregate.id,
            aggregate.getVersion(),
            startStreamVersion,
            startAggregateVersion
          );
        } else {
          LOG.debug(
            'Persisting snapshot for stream %s version %s - start stream version: %s - start aggregate version: %s',
            aggregate.id,
            aggregate.getVersion(),
            startStreamVersion,
            startAggregateVersion
          );
          this.partition.storeSnapshot(aggregate.id, aggregate.getSnapshot(), aggregate.getVersion());
        }
      }

      callback?.(null, aggregate);
      return aggregate;
    } catch (error) {
      LOG.debug('Unable to save commit id: ' + savingWithId + ' for type: ' + this.aggregateType + ', with ' + uncommittedEvents.length + ' events.', error);
      throw error;
    }
  };

  private findByQueryStreamWithSnapshot = async (id: string, isRetry: boolean, callback?: Callback<SpecializedAggregate>): Promise<SpecializedAggregate> => {
    LOG.info('%s findByQueryStreamWithSnapshot(%s)', this.aggregateType, id);

    const aggregate = this.factory(id);
    const { commits, snapshot } = await this.partition.queryStreamWithSnapshot!(id);
    let events: Array<Event<unknown>> = [];

    commits?.forEach((commit: Commit<unknown>) => {
      events = events.concat(commit.events);
    });

    const version = (snapshot?.version ?? 0) + events.length;

    try {
      aggregate._rehydrate(events, version, snapshot?.snapshot);
    } catch (error) {
      // check if this is a retry to prevent infinite loop
      if (this.partition.removeSnapshot && this.resetSnapshotOnFail && !isRetry) {
        await this.partition.removeSnapshot(id);
        return this.findByQueryStreamWithSnapshot(id, true, callback);
      } else {
        throw error;
      }
    }

    callback?.(null, aggregate);
    return aggregate;
  };

  private findBySnapshot = async (id: string, isRetry: boolean, callback?: Callback<SpecializedAggregate>): Promise<SpecializedAggregate> => {
    LOG.info('%s findBySnapshot(%s)', this.aggregateType, id);

    const aggregate = this.factory(id);
    const snapshot = await this.partition.loadSnapshot!(id);
    const commits = await this.partition.queryStream(id, snapshot?.version ?? 0);

    let events: Array<Event<unknown>> = [];

    commits.forEach((commit) => {
      events = events.concat(commit.events);
    });

    const version = (snapshot?.version ?? 0) + events.length;

    try {
      aggregate._rehydrate(events, version, snapshot?.snapshot);
    } catch (error) {
      // check if this is a retry to prevent infinite loop
      if (this.partition.removeSnapshot && this.resetSnapshotOnFail && !isRetry) {
        await this.partition.removeSnapshot(id);
        return this.findBySnapshot(id, true, callback);
      } else {
        callback?.(error);
        throw error;
      }
    }
    callback?.(null, aggregate);
    return aggregate;
  };
}

export default Repository;
