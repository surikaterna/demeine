import Promise from 'bluebird';
import { SnapshotStream } from './SnapshotStream';

export class SnapshotPartition {
  constructor(snapshot, events) {
    this._snapshot = snapshot;
    this._events = events;
  }

  loadSnapshot() {
    return Promise.resolve(this._snapshot);
  }

  openStream() {
    return Promise.resolve(new SnapshotStream());
  }

  storeSnapshot(id, snapshot, version) {
    this._snapshot = { id: id, snapshot: snapshot, version: version };
    return Promise.resolve(this._snapshot);
  }

  removeSnapshot(id) {
    this._snapshot = { id: id, version: -1 };
    return Promise.resolve(this._snapshot);
  }

  queryStream(id, fromEventSequence, callback) {
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
