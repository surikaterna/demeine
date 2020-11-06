import Saga from './Saga';

export interface SagaBinding {
  eventName: string;
  eventHandler: Function;
}

export interface SagaConstructor {
  new (): Saga<any>;
}

export interface SagaAggregateState {
  eventIds: string[];
}

export interface TimeDefinition {}
