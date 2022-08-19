import Promise from 'bluebird';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Stream } from '../Partition';
import { Commit } from '../Repository.interfaces';

export class ConflictStream implements Stream {
  _version: number;

  constructor(version: number) {
    this._version = version;
  }

  getCommittedEvents(): Array<Event> {
    return [
      {
        type: 'location.registered_name.event',
        payload: { name: 'New Name committed' },
        aggregateId: '1',
        id: 'c2d08471-2e0a-4c27-8557-64201f51f249'
      }
    ];
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
