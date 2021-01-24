import { Event } from '@surikat/core-domain';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'uuid';
import Aggregate, { BaseState } from './Aggregate';
import { defaultFactory } from './defaultFactory';

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

export interface Partition<State extends BaseState = BaseState> {
  openStream(id: string, writeOnly?: boolean): Promise<Stream>;
  queryStream<Events = unknown>(id: string, version?: number, callback?: Callback): Promise<Array<Commit<Events>>>;
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

export interface Stream {
  _version: number;
  append(event: Event<unknown>): void;
  commit(id: string): void;
  getCommittedEvents<Types = unknown>(): Array<Event<Types>>;
  getVersion(): number;
}

// export class Repository<State extends BaseState = BaseState> {
export class Repository<StoredAggregate extends Aggregate, State extends BaseState = StoredAggregate['_state']> {
  private readonly aggregateType: string;
  private readonly concurrencyStrategy?: ConcurrencyStrategy;
  private readonly factory: (aggregateType: string) => Aggregate<State>;
  private readonly optimizeWrites: boolean;
  private readonly partition: Partition<State>;
  private readonly resetSnapshotOnFail: boolean;

  constructor(
    partition: Partition<State>,
    aggregateType: string,
    factory?: (aggregateType: string) => Aggregate<State>,
    concurrencyStrategy?: ConcurrencyStrategy,
    options: RepositoryOptions = {}
  ) {
    this.partition = partition;
    this.factory = factory ?? defaultFactory<State>(aggregateType);
    this.aggregateType = aggregateType;
    this.concurrencyStrategy = concurrencyStrategy;

    this.resetSnapshotOnFail = options.resetSnapshotOnFail ?? true;
    this.optimizeWrites = options.resetSnapshotOnFail ?? true; // leaving this option true will not read the entire stream, at the cost of not being able to supply all committed events to the concurrencyStrategy.
  }

  checkConcurrencyStrategy = async <Events = unknown>(
    aggregate: Aggregate<State>,
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
      this.concurrencyStrategy?.(uncommittedEvents);
      return shouldThrow;
    }

    const newStream = await this.partition.openStream(aggregate.id, false);
    shouldThrow = this.concurrencyStrategy(uncommittedEvents, newStream.getCommittedEvents());
    return shouldThrow;
  }

  findById = async (id: string, callback?: Callback<Aggregate<State>>): Promise<Aggregate<State>> => {
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

  findEventsById = async <Events = unknown>(id: string, callback?: Callback<Array<Event<Events>>>): Promise<Array<Event<Events>>> => {
    LOG.info('%s findEventsById(%s)', this.aggregateType, id);

    const stream = await this.partition.openStream(id);
    const events = stream.getCommittedEvents<Events>();

    callback?.(null, events);
    return events;
  };

  save = async (aggregate: Aggregate<State>, commitId?: string, callback?: Callback<Aggregate<State>>): Promise<Aggregate<State>> => {
    const writeOnly = this.concurrencyStrategy ? this.concurrencyStrategy.length < 2 : true;
    const stream = await this.partition.openStream(aggregate.id, this.optimizeWrites);
    const events = await aggregate.getUncommittedEventsAsync();

    const startAggregateVersion = aggregate.getVersion() - events.length;
    const startStreamVersion = stream._version;

    // check if there is a conflict with event version /sequence
    const isNewStream = stream._version === -1;

    if (!isNewStream && this.concurrencyStrategy) {
      const numberOfEvents = events.length;
      const nextStreamVersion = stream._version + numberOfEvents;

      if (nextStreamVersion > aggregate._version) {
        // if so ask concurrency strategy if still ok or if it needs to throw
        const shouldThrow = writeOnly
          ? this.concurrencyStrategy(events)
          : this.concurrencyStrategy(events, stream.getCommittedEvents());

        if (shouldThrow === true) {
          throw new Error('Concurrency error. Version mismatch on stream');
        }
      }
    }

    aggregate.clearUncommittedEvents();

    events.forEach((event) => {
      LOG.debug('%s append event - %s', this.aggregateType, event.id);
      stream.append(event);
    });

    const savingWithId = commitId ?? uuid();

    try {
      await stream.commit(savingWithId);

      LOG.info('Aggregate: %s committed %d events with id: %s', this.aggregateType, events.length, savingWithId);

      if (this.partition.storeSnapshot !== undefined && aggregate.getSnapshot) {
        LOG.debug('Persisting snapshot for stream %s version %d', aggregate.id, aggregate.getVersion());

        if (startStreamVersion > startAggregateVersion) {
          LOG.warn(
            'IGNORING SNAPSHOT STORE. VERSION MISMATCH MIGHT LEAD TO SNAPSHOT FAILURE. for stream %s version %d - start stream version: %d - start aggregate version: %d',
            aggregate.id,
            aggregate.getVersion(),
            startStreamVersion,
            startAggregateVersion
          );
        } else {
          LOG.debug(
            'Persisting snapshot for stream %s version %d - start stream version: %d - start aggregate version: %d',
            aggregate.id,
            aggregate.getVersion(),
            startStreamVersion,
            startAggregateVersion
          );

          this.partition.storeSnapshot(aggregate.id, aggregate.getSnapshot(), aggregate.getVersion());
        }
      }

      return aggregate;
    } catch (error) {
      LOG.debug('Unable to save commit id: %s for type %s, with %d events.', savingWithId, this.aggregateType, events.length);
      callback?.(error);
      throw error;
    }
  };

  private findByQueryStreamWithSnapshot = async (id: string, isRetry: boolean, callback?: Callback<Aggregate<State>>): Promise<Aggregate<State>> => {
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

  private findBySnapshot = async (id: string, isRetry: boolean, callback?: Callback<Aggregate<State>>): Promise<Aggregate<State>> => {
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
