import { Aggregate } from './Aggregate';

export interface AggregateFactory<T extends Aggregate> {
  (id: string): T;
}

export interface AggregateFactoryCreator<T extends Aggregate> {
  (): AggregateFactory<T>;
}

export function DefaultFactory<T extends Aggregate = Aggregate>(aggregateType?: string): AggregateFactory<T> {
  return function() {
    return new Aggregate() as T;
  };
}
