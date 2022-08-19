import Promise from 'bluebird';
import { Aggregate } from '../../aggregate';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Partition } from '../Partition';
import { ConflictStream } from './ConflictStream';

export class ConflictPartition implements Partition {
  _version: number;

  constructor() {
    this._version = 1;
  }

  openStream() {
    this._version += 1;
    return Promise.resolve(new ConflictStream(this._version));
  };

  delete(id: string, event: Event): Promise<Aggregate> {
    return Promise.resolve(new Aggregate());
  }
}
