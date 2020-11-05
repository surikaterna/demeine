import { v4 as uuid } from 'uuid';
import Event from './Event';
import Aggregate from './Aggregate';
import defaultFactory from './defaultFactory';

interface Commit {
  events: Event[];
}

interface Snapshot {
  version: number;
  snapshot: object;
}

interface StreamWithSnapshot {
  commits: Commit[];
  snapshot: Snapshot;
}

interface Stream {
  _version: number;
  getCommittedEvents(): Event[];
  getUncommittedEventsAsync?(): Promise<Event[]>;
  getVersion(): number;
  append(event: Event): void;
  commit(id?: string): Promise<any>;
}

interface Partition {
  openStream(id: string, writeOnly?: Boolean): Promise<Stream>;
  queryStream(id: string, fromVersion?: number): Promise<Commit[]>;
  queryStreamWithSnapshot?(id: string): Promise<StreamWithSnapshot>;
  loadSnapshot?(id: string): Promise<Snapshot | undefined>;
  removeSnapshot?(id: string): Promise<Snapshot | undefined>;
  storeSnapshot?(aggregateId: string, snapshot: object, version: number): void;
}

interface Options {
  resetSnapshotOnFail: Boolean;
}

const LOG = require('slf').Logger.getLogger('demeine:repository');

const nodeify = <T>(promise: Promise<T>, callback?: Function): Promise<T> => {
  if (callback) {
    promise.then(
      (result: T) => callback(null, result),
      (err: Error) => callback(err)
    );
  }
  return promise;
};

export default class Repository {
  _partition: Partition;
  _factory: Function;
  _aggregateType: string;
  _concurrencyStrategy?: Function;
  _resetSnapshotOnFail: Boolean;

  constructor(partition: Partition, aggregateType: string, factory?: Function, concurrencyStrategy?: Function, options?: Options) {
    this._partition = partition;
    this._factory = factory || defaultFactory();
    this._aggregateType = aggregateType;
    this._concurrencyStrategy = concurrencyStrategy;
    this._resetSnapshotOnFail = options?.resetSnapshotOnFail ?? true;
  }

  findById(id: string, callback?: Function) {
    LOG.info('%s findById(%s)', this._aggregateType, id);
    if (this._partition.queryStreamWithSnapshot !== undefined) {
      return this.findByQueryStreamWithSnapshot(id, false, callback);
    } else if (this._partition.loadSnapshot !== undefined) {
      return this.findBySnapshot(id, false, callback);
    } else {
      const aggregate = this._factory(id);
      return nodeify(
        this._partition.openStream(id).then(stream => {
          const events = stream.getCommittedEvents();
          const version = stream.getVersion();
          aggregate._rehydrate(events, version);
          return aggregate;
        }),
        callback
      );
    }
  }

  findBySnapshot(id: string, isRetry: boolean, callback?: Function): Promise<Aggregate<any>> {
    LOG.info('%s findBySnapshot(%s)', this._aggregateType, id);
    var aggregate = this._factory(id);
    if (!this._partition.loadSnapshot) {
      throw new Error('Cannot loadSnapshot - partition does not support this operation');
    }
    return nodeify(
      this._partition.loadSnapshot(id).then(snapshot => {
        return this._partition.queryStream(id, (snapshot && snapshot.version) || 0).then(commits => {
          let events: Event[] = [];
          commits.forEach(commit => {
            events = events.concat(commit.events);
          });
          const version = ((snapshot && snapshot.version) || 0) + events.length;
          try {
            aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
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
      }),
      callback
    );
  }

  findByQueryStreamWithSnapshot(id: string, isRetry: boolean, callback?: Function): Promise<Aggregate<any>> {
    LOG.info('%s findByQueryStreamWithSnapshot(%s)', this._aggregateType, id);
    var aggregate = this._factory(id);
    if (!this._partition.queryStreamWithSnapshot) {
      throw new Error('Cannot queryStreamWithSnapshot - partition does not support this operation');
    }
    return nodeify(
      this._partition.queryStreamWithSnapshot(id).then(response => {
        const commits = response.commits;
        const snapshot = response.snapshot;
        let events: Event[] = [];
        if (commits) {
          commits.forEach(commit => {
            events = events.concat(commit.events);
          });
        }
        var version = ((snapshot && snapshot.version) || 0) + events.length;
        try {
          aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
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
      }),
      callback
    );
  }

  findEventsById(id: string, callback?: Function) {
    LOG.info('%s findEventsById(%s)', this._aggregateType, id);
    return nodeify(
      this._partition.openStream(id).then(stream => {
        const events = stream.getCommittedEvents();
        return events;
      }),
      callback
    );
  }

  checkConcurrencyStrategy(aggregate: Aggregate<any>, stream: Stream, uncommittedEvents: Event[]) {
    const isNewStream = stream._version === -1;
    let shouldThrow = false;
    return new Promise(resolve => {
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
            this._partition.openStream(aggregate.id, false).then(newStream => {
              if (!this._concurrencyStrategy) {
                resolve(shouldThrow);
              } else {
                shouldThrow = this._concurrencyStrategy(uncommittedEvents, newStream.getCommittedEvents());
                resolve(shouldThrow);
              }
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

  save(aggregate: Aggregate<any>, commitId?: string, callback?: Function): Promise<Aggregate<any>> {
    let savingWithId = commitId;
    return nodeify(
      this._partition.openStream(aggregate.id, true).then(stream => {
        return aggregate.getUncommittedEventsAsync().then(uncommittedEvents => {
          const startAggregateVersion = aggregate.getVersion() - uncommittedEvents.length;
          const startStreamVersion = stream._version;
          return this.checkConcurrencyStrategy(aggregate, stream, uncommittedEvents).then(shouldThrow => {
            if (shouldThrow === true) {
              throw new Error('Concurrency error. Version mismatch on stream');
            }
            aggregate.clearUncommittedEvents();
            savingWithId = savingWithId || uuid();
            uncommittedEvents.forEach(event => {
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
              .catch(e => {
                LOG.debug(
                  'Unable to save commmit id: ' + savingWithId + ' for type: ' + this._aggregateType + ', with ' + uncommittedEvents.length + ' events.',
                  e
                );
                throw e;
              });
          });
        });
      }),
      callback
    );
  }
}
