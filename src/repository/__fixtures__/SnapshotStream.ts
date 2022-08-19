import Promise from 'bluebird';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Stream } from '../Partition';
import { Commit } from '../Repository.interfaces';

export class SnapshotStream implements Stream {
  _version = -1;

  getCommittedEvents() {
    return [];
  }

  getVersion() {
    return this._version;
  }

  append(event: Event): Promise<Array<Commit>> {
    return Promise.resolve([]);
  }

  commit(id: string): Promise<void> {
    return Promise.resolve();
  }
}
