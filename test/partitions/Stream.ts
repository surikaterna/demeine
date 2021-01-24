import { Event } from '@surikat/core-domain';
import { Stream as RepositoryStream } from '../../src/aggregate';

export class Stream implements RepositoryStream {
  _version: number;

  constructor(_streamId: string) {
    this._version = -1;
  }

  append(_event: Event<unknown>): void {}

  commit(_id: string): void {}

  getCommittedEvents<Types = unknown>(): Array<Event<Types>> {
    return [];
  }

  getVersion(): number {
    return this._version;
  }
}

export default Stream;
