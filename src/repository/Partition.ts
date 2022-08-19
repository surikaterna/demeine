import Promise from 'bluebird';
import { Aggregate } from '../aggregate';
import { Event } from '../aggregate/Aggregate.interfaces';
import { Commit } from './Repository.interfaces';

export interface AggregateSnapshot<State extends object = object> {
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

export interface Partition<State extends object = object, Payload extends object = object> {
  delete(id: string, event: Event<Payload>): Promise<Aggregate<State>>;
  loadSnapshot?(id: string): Promise<AggregateSnapshot<State> | null>;
  openStream(id: string, isWriteOnly?: boolean): Promise<Stream<Payload>>;
  queryStream?(id: string, version: number): Promise<Array<Commit<Payload>>>;
  queryStreamWithSnapshot?(id: string): Promise<QueryStreamResponse<State, Payload>>;
  removeSnapshot?(id: string): Promise<void>;
  storeSnapshot?(id: string, state?: State, version?: number): Promise<void>;
}
