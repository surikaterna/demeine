import Promise from 'bluebird';
import { Aggregate } from '../../aggregate';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Partition, Stream } from '../Partition';
import { ConflictStream } from './ConflictStream';

export class ConflictPartition<T extends Aggregate = Aggregate, P extends object = object> implements Partition<T, P> {
  _version: number;

  constructor() {
    this._version = 1;
  }

  openStream(id: string, isWriteOnly?: boolean): Promise<Stream<P>> {
    this._version += 1;
    return Promise.resolve(new ConflictStream(this._version));
  };

  delete(id: string, event: Event): Promise<T> {
    return Promise.resolve(new Aggregate() as T);
  }
}
