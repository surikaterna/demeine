import { Aggregate, BaseState } from './Aggregate';

export function defaultFactory<State extends BaseState = BaseState>(_aggregateType: string) {
  return function (): Aggregate<State> {
    return new Aggregate();
  };
}

export default defaultFactory;
