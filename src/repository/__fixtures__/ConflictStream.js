import Promise from 'bluebird';

export class ConflictStream {
  constructor(version) {
    this._version = version;
  }

  getCommittedEvents() {
    return [
      {
        type: 'location.registered_name.event',
        payload: 'New Name committed',
        aggregateId: 1,
        id: 'c2d08471-2e0a-4c27-8557-64201f51f249'
      }
    ];
  }

  getVersion() {
    return this._version;
  }

  append() {
  }

  commit() {
    return Promise.resolve(null);
  }
}
