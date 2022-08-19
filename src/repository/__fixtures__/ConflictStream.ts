import Promise from 'bluebird';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Stream } from '../Partition.interfaces';
import { Commit } from '../Repository.interfaces';

export class ConflictStream<P extends object = object> implements Stream<P> {
  _version: number;

  constructor(version: number) {
    this._version = version;
  }

  getCommittedEvents(): Array<Event<P>> {
    return [
      {
        type: 'location.registered_name.event',
        payload: { name: 'New Name committed' } as P,
        aggregateId: '1',
        id: 'c2d08471-2e0a-4c27-8557-64201f51f249'
      }
    ];
  }

  getVersion() {
    return this._version;
  }

  append(event: Event): Promise<Array<Commit<P>>> {
    return Promise.resolve([]);
  }

  commit(id: string): Promise<void> {
    return Promise.resolve();
  }
}
