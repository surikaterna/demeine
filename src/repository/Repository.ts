import Promise from 'bluebird';
import { v4 as uuid } from 'uuid';
import { Aggregate } from '../aggregate';
import { Event } from '../aggregate/Aggregate.interfaces';
import { AggregateFactory, DefaultFactory } from '../aggregate/DefaultFactory';
import { getMessageFromError } from '../utils/errorUtils';
import { Partition, Stream } from './Partition.interfaces';
import { Callback, ConcurrencyStrategy, RepositoryOptions } from './Repository.interfaces';

const LOG = require('slf').Logger.getLogger('demeine:repository');

export class Repository<T extends Aggregate = Aggregate, Payload extends object = object> {
  _partition: Partition<T, Payload>;
  _factory: AggregateFactory<T>;
  _aggregateType: string;
  _resetSnapshotOnFail: boolean;
  _concurrencyStrategy?: ConcurrencyStrategy<Payload>;

  constructor(partition: Partition<T, Payload>, aggregateType: string, factory?: AggregateFactory<T>, concurrencyStrategy?: ConcurrencyStrategy<Payload>, options: RepositoryOptions = {}) {
    this._partition = partition;
    this._factory = factory || DefaultFactory<T>(aggregateType);
    this._aggregateType = aggregateType;
    this._concurrencyStrategy = concurrencyStrategy;
    this._resetSnapshotOnFail = options.resetSnapshotOnFail ?? true;
  }

  findById(id: string, callback?: Callback<T>): Promise<T> {
    LOG.info('%s findById(%s)', this._aggregateType, id);
    if (this._partition.queryStreamWithSnapshot !== undefined) {
      return this.findByQueryStreamWithSnapshot(id, false, callback);
    } else if (this._partition.loadSnapshot !== undefined) {
      return this.findBySnapshot(id, false, callback);
    } else {
      const aggregate = this._factory(id);
      return this._partition
        .openStream(id)
        .then((stream) => {
          const events = stream.getCommittedEvents();
          const version = stream.getVersion();
          aggregate._rehydrate(events, version);
          return aggregate;
        })
        .nodeify(callback);
    }
  }

  findBySnapshot(id: string, isRetry: boolean, callback?: Callback<T>): Promise<T> {
    LOG.info('%s findBySnapshot(%s)', this._aggregateType, id);
    const loadSnapshot = this._partition.loadSnapshot?.bind(this._partition);
    const queryStream = this._partition.queryStream?.bind(this._partition);

    if (!loadSnapshot) {
      throw new Error('Trying to find aggregate by snapshot, but partition is missing "loadSnapshot" method.');
    }

    if (!queryStream) {
      throw new Error('Trying to find aggregate by snapshot, but partition is missing "queryStream" method.');
    }

    const aggregate = this._factory(id);
    return loadSnapshot(id)
      .then((aggregateSnapshot) => {
        const version = aggregateSnapshot?.version ?? 0;
        const snapshot = aggregateSnapshot?.snapshot;
        return queryStream(id, version).then((commits) => {
          const events = commits.flatMap((commit) => commit.events);
          const newVersion = version + events.length;
          try {
            aggregate._rehydrate(events, newVersion, snapshot);
          } catch (e) {
            if (this._partition.removeSnapshot && this._resetSnapshotOnFail && !isRetry) {
              // check if this is a retry to prevent infinite loop
              // delete snapshot and retry...
              return this._partition.removeSnapshot(id).then(() => {
                return this.findBySnapshot(id, true, callback);
              });
            } else {
              throw e;
            }
          }
          return aggregate;
        });
      })
      .nodeify(callback);
  }

  findByQueryStreamWithSnapshot(id: string, isRetry: boolean, callback?: Callback<T>): Promise<T> {
    LOG.info('%s findByQueryStreamWithSnapshot(%s)', this._aggregateType, id);

    const queryStreamWithSnapshot = this._partition.queryStreamWithSnapshot?.bind(this._partition);

    if (!queryStreamWithSnapshot) {
      throw new Error('Trying to find aggregate by query stream with snapshot, but partition is missing "queryStreamWithSnapshot" method.');
    }

    const aggregate = this._factory(id);
    return queryStreamWithSnapshot(id)
      .then((response) => {
        const commits = response.commits;
        const aggregateSnapshot = response.snapshot;
        const snapshot = aggregateSnapshot?.snapshot;
        const events = commits.flatMap((commit) => commit.events);
        const newVersion = (aggregateSnapshot?.version ?? 0) + events.length;

        try {
          aggregate._rehydrate(events, newVersion, snapshot);
        } catch (e) {
          if (this._partition.removeSnapshot && this._resetSnapshotOnFail && !isRetry) {
            // check if this is a retry to prevent infinite loop
            // delete snapshot and retry...
            return this._partition.removeSnapshot(id).then(() => {
              return this.findByQueryStreamWithSnapshot(id, true, callback);
            });
          } else {
            throw e;
          }
        }
        return aggregate;
      })
      .nodeify(callback);
  }

  findEventsById(id: string, callback: Callback<Array<Event<Payload>>>): Promise<Array<Event<Payload>>> {
    LOG.info('%s findEventsById(%s)', this._aggregateType, id);
    return this._partition
      .openStream(id)
      .then((stream) => stream.getCommittedEvents())
      .nodeify(callback);
  }

  checkConcurrencyStrategy(aggregate: T, stream: Stream<Payload>, uncommittedEvents: Array<Event<Payload>>): Promise<boolean> {
    const isNewStream = stream._version === -1;
    let shouldThrow = false;
    return new Promise((resolve) => {
      if (!isNewStream && this._concurrencyStrategy) {
        const numberOfEvents = uncommittedEvents.length;
        const nextStreamVersion = stream._version + numberOfEvents;
        if (nextStreamVersion > aggregate._version) {
          // if _concurrencyStrategy has two arguments, we need to load up all events, since client requested it.
          const writeOnly = this._concurrencyStrategy ? this._concurrencyStrategy.length < 2 : true;
          if (writeOnly) {
            shouldThrow = this._concurrencyStrategy(uncommittedEvents);
            resolve(shouldThrow);
          } else {
            this._partition.openStream(aggregate.id, false).then((newStream) => {
              shouldThrow = this._concurrencyStrategy ? this._concurrencyStrategy(uncommittedEvents, newStream.getCommittedEvents()) : shouldThrow;
              resolve(shouldThrow);
            });
          }
        } else {
          resolve(shouldThrow);
        }
      } else {
        resolve(shouldThrow);
      }
    });
  }

  _getDeleteEvent(events: Array<Event<Payload>>): Event<Payload> | null {
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === '$stream.deleted.event') {
        return events[i];
      }
    }
    return null;
  }

  _delete(aggregate: T, deleteEvent: Event<Payload>): Promise<T> {
    return this._partition.delete(aggregate.id, deleteEvent);
  }

  save(aggregate: T, commitId?: string, callback?: Callback<T>): Promise<T> {
    let savingWithId = commitId;
    return this._partition
      .openStream(aggregate.id, true)
      .then((stream) => {
        return aggregate.getUncommittedEventsAsync<Payload>().then((uncommittedEvents) => {
          const deleteEvent = this._getDeleteEvent(uncommittedEvents);
          if (deleteEvent) {
            return this._delete(aggregate, deleteEvent);
          } else {
            const startAggregateVersion = aggregate.getVersion() - uncommittedEvents.length;
            const startStreamVersion = stream._version;
            return this.checkConcurrencyStrategy(aggregate, stream, uncommittedEvents).then((shouldThrow) => {
              if (shouldThrow === true) {
                throw new Error('Concurrency error. Version mismatch on stream');
              }
              aggregate.clearUncommittedEvents();
              savingWithId = savingWithId || uuid();
              uncommittedEvents.forEach((event) => {
                LOG.debug('%s append event - %s', this._aggregateType, event.id);
                stream.append(event);
              });
              return stream
                .commit(savingWithId)
                .then(() => {
                  LOG.info('Aggregate: %s committed %d events with id: %s', this._aggregateType, uncommittedEvents.length, savingWithId);
                  if (this._partition.storeSnapshot !== undefined && aggregate._getSnapshot) {
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
                      this._partition.storeSnapshot(aggregate.id, aggregate._getSnapshot(), aggregate.getVersion());
                    }
                  }
                  return aggregate;
                })
                .error((err) => {
                  LOG.debug(
                    'Unable to save commit id: %s for type: %s, with %d events. Error: %s',
                    savingWithId,
                    this._aggregateType,
                    uncommittedEvents.length,
                    getMessageFromError(err)
                  );
                  throw err;
                });
            });
          }
        });
      })
      .nodeify(callback);
  }
}
