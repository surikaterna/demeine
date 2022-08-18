import { Aggregate } from './Aggregate';

export interface AggregateFactory<State extends object = object> {
  (): Aggregate<State>;
}

export function DefaultFactory<State extends object = object>(aggregateType?: string): AggregateFactory<State> {
  return function() {
    return new Aggregate<State>();
  };
}
