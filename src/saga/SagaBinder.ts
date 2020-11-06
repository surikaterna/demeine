import { SagaConstructor } from './SagaTypes';
import { SagaDefinition } from './SagaDefinition';

export default class SagaBinder {
  _definition: SagaDefinition;

  constructor(sagaConstructor: SagaConstructor) {
    this._definition = new SagaDefinition();
    this._definition.sagaConstructor = sagaConstructor;
  }

  startsBy(eventName: string, eventHandler: Function): this {
    this._definition.startByEvents.push({ eventName, eventHandler });
    return this;
  }
  handles(eventName: string, eventHandler: Function): this {
    this._definition.handlesEvents.push({ eventName, eventHandler });
    return this;
  }
  definition() {
    return this._definition;
  }
}
