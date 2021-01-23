import { Event } from '@surikat/core-domain';
import { Snapshot } from '../../src/aggregate/Repository';

export class SnapshotPartition {
  private events: Event<unknown>[];
  private snapshot: Snapshot;

  constructor(snapshot: Snapshot, events: Event<unknown>[]) {
    this.snapshot = snapshot;
    this.events = events;
  }

  openStream = (streamId: string) => {
    class Stream {
      constructor(_streamId: string) {
      }

      append = (): void => {
      };
      commit = (): Promise<null> => Promise.resolve(null);
      getCommittedEvents = (): Array<unknown> => [];
      getVersion = (): number => -1;
    }

    return Promise.resolve(new Stream(streamId));
  };

  storeSnapshot = (id: string, snapshot: Snapshot, version: number): Promise<Snapshot> => {
    this.snapshot = { id, snapshot, version };
    return Promise.resolve(this.snapshot);
  };

  removeSnapshot = (id: string): Promise<Snapshot> => {
    this.snapshot = { id, version: -1 };
    return Promise.resolve(this.snapshot);
  };

  queryStream = (id, fromEventSequence, callback): Promise<{ events: Event<unknown>[] }[]> => {
    let result = [{ events: this.events }];

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

export default SnapshotPartition;
