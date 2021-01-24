import { Event } from '@surikat/core-domain';
import { BaseState, Callback, Commit, Partition as RepositoryPartition, Snapshot } from '../../src/aggregate';
import Stream from './Stream';

export class SnapshotPartition<State extends BaseState = BaseState> implements RepositoryPartition<State> {
  private events: Array<Event<unknown>>;
  private snapshot?: Snapshot<State>;

  constructor(snapshot: Snapshot<State> | undefined, events: Array<Event<unknown>>) {
    this.snapshot = snapshot as Snapshot<State>;
    this.events = events;
  }

  loadSnapshot = (_id: string): Promise<Snapshot<State> | undefined> => Promise.resolve(this.snapshot);

  openStream = (streamId: string) => {
    return Promise.resolve(new Stream(streamId));
  };

  storeSnapshot = (id: string, snapshot: State, version: number): Promise<Snapshot<State>> => {
    this.snapshot = { id, snapshot, version };
    return Promise.resolve(this.snapshot);
  };

  removeSnapshot = (id: string): Promise<Snapshot<State>> => {
    this.snapshot = { id, version: -1 };
    return Promise.resolve(this.snapshot);
  };

  queryStream = <Events = unknown>(_id: string, fromEventSequence?: number, callback?: Callback): Promise<Array<Commit<Events>>> => {
    let result = ([{ events: this.events }] as unknown) as Array<Commit<Events>>;

    if (!fromEventSequence || fromEventSequence < 1) {
      callback?.(null, result);
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

    callback?.(null, result);
    return Promise.resolve(result);
  };
}

export default SnapshotPartition;
