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
  openStream(id: string): Promise<Stream>;
  queryStream(id: string, fromVersion?: number): Promise<Commit[]>;
  queryStreamWithSnapshot?(id: string): Promise<StreamWithSnapshot>;
  loadSnapshot?(id: string): Promise<Snapshot | undefined>;
  storeSnapshot?(aggregateId: string, snapshot: object, version: number): void;
}

const LOG = require('slf').Logger.getLogger('demeine:repository');

const nodeify = <T>(promise: Promise<T>, callback?: Function): Promise<T> => {
  if (callback) {
    promise.then(
      (result: T) => callback(null, result),
      (err: Error) => callback(err));
  }
  return promise;
}

export default class Repository {
  aggregateType?: string;
  _partition: Partition;
  _factory: Function;
  _aggregateType: string;
  _concurrencyStrategy?: Function;

  constructor(partition: Partition, aggregateType: string, factory?: Function, concurrencyStrategy?: Function) {
    this._partition = partition;
    this._factory = factory || defaultFactory(aggregateType);
    this._aggregateType = aggregateType;
    this._concurrencyStrategy = concurrencyStrategy;
  }

  findById(id: string, callback?: Function) {
    LOG.info('%s findById(%s)', this.aggregateType, id);
    const aggregate = this._factory(id);
    // const hasSnapshot = this._partition.loadSnapshot !== undefined;
    // const hasQueryStreamWithSnapshotFunc = ;
    if (this._partition.queryStreamWithSnapshot !== undefined) {
      return nodeify(
        this._partition.queryStreamWithSnapshot(id).then((response) => {
          const commits = response.commits;
          const snapshot = response.snapshot;
          let events: Event[] = [];
          if (commits) {
            commits.forEach((commit) => {
              events = events.concat(commit.events);
            });
          }
          const version = (snapshot && snapshot.version || 0) + events.length;
          aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
          return aggregate;
        }),
        callback);
    } if (this._partition.loadSnapshot !== undefined) {
      return nodeify(
        this._partition.loadSnapshot(id).then((snapshot) => {
          return this._partition.queryStream(id, (snapshot && snapshot.version) || 0).then((commits) => {
            let events: Event[] = [];
            commits.forEach((commit) => {
              events = events.concat(commit.events);
            });
            const version = (snapshot && snapshot.version || 0) + events.length;
            aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
            return aggregate;
          });
        }),
        callback);
    }
    return nodeify(
      this._partition.openStream(id).then((stream) => {
        const events = stream.getCommittedEvents();
        const version = stream.getVersion();
        aggregate._rehydrate(events, version);
        return aggregate;
      }),
      callback);

  }

  findEventsById(id: string, callback?: Function) {
    LOG.info('%s findEventsById(%s)', this.aggregateType, id);
    return nodeify(this._partition.openStream(id).then((stream) => {
      const events = stream.getCommittedEvents();
      return events;
    }), callback);
  }

  save(aggregate: Aggregate<any>, commitId?: string, callback?: Function): Promise<Aggregate<any>> {
    let savingWithId = commitId;
    const self = this;
    return nodeify(
      this._partition.openStream(aggregate.id).then((stream) => {
        return aggregate
          .getUncommittedEventsAsync()
          .then((events) => {
            // check if there is a conflict with event version /sequence
            const isNewStream = stream._version === -1;
            if (!isNewStream && self._concurrencyStrategy) {
              const numberOfEvents = events.length;
              const nextStreamVersion = stream._version + numberOfEvents;
              if (nextStreamVersion > aggregate._version) {
                // if so ask concurrency strategy if still ok or if it needs to throw
                const shouldThrow = self._concurrencyStrategy(events, stream.getCommittedEvents());
                if (shouldThrow === true) {
                  throw new Error('Concurrency error. Version mismatch on stream');
                }
              }
            }
            aggregate.clearUncommittedEvents();
            savingWithId = savingWithId || uuid();
            events.forEach((event) => {
              LOG.debug('%s append event - %s', self.aggregateType, event.id);
              stream.append(event);
            });
            return stream.commit(savingWithId).then(() => {
              LOG.info('%s committed %d events with %s id', self.aggregateType, events.length, commitId);
              if (self._partition.storeSnapshot !== undefined && aggregate._getSnapshot) {
                LOG.debug('Persisting snapshot for stream %s version %s', aggregate.id, aggregate.getVersion());
                self._partition.storeSnapshot(aggregate.id, aggregate._getSnapshot(), aggregate.getVersion());
              }
              return aggregate;
            }).catch((e) => {
              LOG.debug(`Unable to save commmit id: ${commitId} for type: ${self.aggregateType} with ${events.length} events.`, e);
              throw e;
            });
          });
      }),
      callback);
  }

}
