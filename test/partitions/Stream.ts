import { Event } from '@surikat/core-domain';
import { Stream as RepositoryStream } from '../../src/aggregate';

export class Stream<Types = unknown> implements RepositoryStream {
  _version: number;
  events: Array<Event<Types>>;

  constructor(_streamId: string | number, events: Array<Event<Types>> = [], initialVersion = -1) {
    this._version = initialVersion;
    this.events = events;
  }

  append(_event: Event<unknown>): void {}

  commit(_id: string): Promise<void> {
    return Promise.resolve();
  }

  getCommittedEvents(): Array<Event<Types>> {
    return this.events;
  }

  getVersion(): number {
    return this._version;
  }
}

export default Stream;
