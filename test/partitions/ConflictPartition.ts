import { Event } from '@surikat/core-domain';
import { BaseState, Commit } from '../../src/aggregate';
import { Callback, Partition as RepositoryPartition, Snapshot } from '../../src/aggregate/Repository';
import { Stream } from './Stream';

export class ConflictPartition<State extends BaseState = BaseState, Events = unknown> implements RepositoryPartition<State, Events> {
  static mockVersion = 1;
  private events?: Event<Events>[];
  private snapshot: Snapshot<State>;

  constructor(snapshot: number, events?: Event<Events>[]) {
    this.snapshot = { id: String(snapshot) };
    this.events = events;

    ConflictPartition.mockVersion = 1;
  }

  openStream = (streamId: string, _writeOnly?: boolean): Promise<Stream<Events>> => {
    ++ConflictPartition.mockVersion;
    return Promise.resolve(new Stream<Events>(streamId, this.events, ConflictPartition.mockVersion));
  };

  storeSnapshot = (id: string, snapshot: State, version: number): Promise<Snapshot<State>> => {
    this.snapshot = { id, snapshot, version };
    return Promise.resolve(this.snapshot);
  };

  removeSnapshot = (id: string): Promise<Snapshot<State>> => {
    this.snapshot = { id, version: -1 };
    return Promise.resolve(this.snapshot);
  };

  queryStream = (_id: string, fromEventSequence: number, callback: Callback): Promise<Commit<Events>[]> => {
    let result = [{ events: this.events }] as Commit<Events>[];

    if (fromEventSequence < 1) {
      callback(null, result);
      return Promise.resolve(result);
    }

    let startCommitId = 0;
    let foundEvents = 0;

    for (let i = 0; i < result.length; i++) {
      foundEvents += result[0].events.length;
      startCommitId++;

      if (foundEvents >= fromEventSequence) {
        break;
      }
    }

    const tooMany = foundEvents - fromEventSequence;
    result = result.slice(startCommitId - (tooMany > 0 ? 1 : 0));

    if (tooMany > 0) {
      result[0].events = result[0].events.slice(result[0].events.length - tooMany);
    }

    callback(null, result);
    return Promise.resolve(result);
  };
}

export default ConflictPartition;
