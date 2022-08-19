import Promise from 'bluebird';
import { Aggregate } from '../../aggregate';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { AggregateSnapshot, Partition } from '../Partition';
import { Callback, Commit } from '../Repository.interfaces';
import { SnapshotStream } from './SnapshotStream';

export class SnapshotPartition<T extends Aggregate = Aggregate> implements Partition<T> {
  private _snapshot?: AggregateSnapshot;
  private _events: Array<Event>;

  constructor(snapshot: AggregateSnapshot | undefined, events: Array<Event>) {
    this._snapshot = snapshot;
    this._events = events;
  }

  delete(id: string, event: Event): Promise<T> {
    throw new Error('Method not implemented.');
  }

  loadSnapshot(id: string): Promise<AggregateSnapshot<T['_state']> | null> {
    return Promise.resolve(this._snapshot ?? null);
  }

  openStream() {
    return Promise.resolve(new SnapshotStream());
  }

  storeSnapshot(id: string, snapshot?: object, version?: number): Promise<void> {
    this._snapshot = { id, snapshot, version };
    return Promise.resolve();
  }

  removeSnapshot(id: string): Promise<void> {
    this._snapshot = { id: id, version: -1 };
    return Promise.resolve();
  }

  queryStream?(id: string, fromEventSequence: number, callback?: Callback<Array<Commit>>): Promise<Array<Commit>> {
    let result = [{ events: this._events }];
    if (fromEventSequence > 0) {
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
    }
    return Promise.resolve(result).nodeify(callback);
  }
}
