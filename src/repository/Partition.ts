import Promise from 'bluebird';
import { Aggregate } from '../aggregate';
import { Event } from '../aggregate/Aggregate.interfaces';
import { Callback, Commit } from './Repository.interfaces';

export interface AggregateSnapshot<State extends object = object> {
  id?: string;
  snapshot?: State;
  version?: number;
}

interface QueryStreamResponse<State extends object = object, Payload extends object = object> {
  commits: Array<Commit<Payload>>;
  snapshot?: AggregateSnapshot<State>;
}

export interface Stream<Payload extends object = object> {
  append(event: Event<Payload>): Promise<Array<Commit<Payload>>>;
  commit(id: string): Promise<void>;
  getCommittedEvents(): Array<Event<Payload>>;
  getVersion(): number;
  _version: number;
}

export interface Partition<T extends Aggregate = Aggregate, Payload extends object = object> {
  delete(id: string, event: Event<Payload>): Promise<T>;
  loadSnapshot?(id: string): Promise<AggregateSnapshot<T['_state']> | null>;
  openStream(id: string, isWriteOnly?: boolean): Promise<Stream<Payload>>;
  queryStream?(id: string, version: number, callback?: Callback<Array<Commit<Payload>>>): Promise<Array<Commit<Payload>>>;
  queryStreamWithSnapshot?(id: string): Promise<QueryStreamResponse<T['_state'], Payload>>;
  removeSnapshot?(id: string): Promise<void>;
  storeSnapshot?(id: string, state?: T['_state'], version?: number): Promise<void>;
}
