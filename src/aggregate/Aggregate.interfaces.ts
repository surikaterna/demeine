import { Aggregate } from './Aggregate';

export interface ApplyFunc<State extends object = object> {
  (event: Event): void;
}

export interface Command<Payload extends object = object> {
  type: string;
  payload: Payload;
  id?: string;
  aggregateType?: string;
  aggregateId?: string;
}

export interface CommandHandler<State extends object = object> {
  handle(aggregate: Aggregate<State>, command: Command): Aggregate<State>;
}

export interface CommandSink<State extends object = object> {
  sink(cmd: Command, aggregate: Aggregate<State>): Promise<Aggregate<State>>;
}

export interface Event<Payload extends object = object> {
  type: string;
  payload: Payload;
  id?: string;
  aggregateId?: string;
  correlationId?: string;
}

export interface EventHandler<State extends object = object> {
  handle(aggregate: Aggregate<State>, event: Event): void;
}

export interface ProcessFunc<State extends object = object> {
  (command: Command): Aggregate<State>;
}
