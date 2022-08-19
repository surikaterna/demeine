import { Aggregate } from './Aggregate';

export interface AggregateFactory<State extends object = object> {
  (id: string): Aggregate<State>;
}

export interface AggregateFactoryCreator<State extends object = object> {
  (): AggregateFactory<State>;
}

export function DefaultFactory<State extends object = object>(aggregateType?: string): AggregateFactory<State> {
  return function() {
    return new Aggregate<State>();
  };
}
