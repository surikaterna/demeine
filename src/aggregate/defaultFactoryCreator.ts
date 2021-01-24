import { Aggregate, BaseState } from './Aggregate';

export interface AggregateFactory<SpecializedAggregate extends Aggregate> {
  (id?: string): SpecializedAggregate;
}

export interface AggregateFactoryCreator<SpecializedAggregate extends Aggregate> {
  (aggregateType?: string): AggregateFactory<SpecializedAggregate>;
}

export const defaultFactoryCreator: AggregateFactoryCreator<Aggregate<BaseState>> = () => {
  return function (): Aggregate {
    return new Aggregate<BaseState>();
  };
}

export default defaultFactoryCreator;
