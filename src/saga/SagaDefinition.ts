import { SagaBinding, SagaConstructor } from './SagaTypes';

export class SagaDefinition {
  sagaConstructor?: SagaConstructor;
  startByEvents: SagaBinding[] = [];
  handlesEvents: SagaBinding[] = [];
  // lookup by
}
