import { Event } from '../aggregate/Aggregate.interfaces';

export interface Callback<Result> {
  (err: Error): void;
  (err: null, result: Result): void;
  (err: Error | null, result?: Result): void;
}

export interface Commit<Payload extends object = object> {
  events: Array<Event<Payload>>;
}

export interface ConcurrencyStrategy<Payload extends object = object> {
  (uncommittedEvents: Array<Event<Payload>>, committedEvents?: Array<Event<Payload>>): boolean;
}

export interface RepositoryOptions {
  resetSnapshotOnFail?: boolean;
}
