import Promise from 'bluebird';
import { ConflictStream } from './ConflictStream';

export class ConflictPartition {
  constructor() {
    this._version = 1;
  }

  openStream() {
    this._version += 1;
    return Promise.resolve(new ConflictStream(this._version));
  };
}
