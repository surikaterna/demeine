import Promise from 'bluebird';

export class SnapshotStream {
  getCommittedEvents() {
    return [];
  }

  getVersion() {
    return -1;
  }

  append() {
  }

  commit() {
    return Promise.resolve(null);
  }
}
