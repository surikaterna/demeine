import Promise from 'bluebird';

export class Stream {
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
