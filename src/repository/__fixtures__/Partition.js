import Promise from 'bluebird';
import { Stream } from './Stream';

export class Partition {
  openStream() {
    return Promise.resolve(new Stream());
  }

  delete(streamId, event) {
  }
}
