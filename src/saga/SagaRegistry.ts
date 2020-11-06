import { SagaDefinition } from './SagaDefinition';

export default class SagaRegistry {
  private _sagaDefinitions: SagaDefinition[] = [];

  register(sagaDefinition: SagaDefinition) {
    this._sagaDefinitions.push(sagaDefinition);
  }

  findSagaStarters(type: string) {
    return this._sagaDefinitions.filter(def => def.startByEvents.findIndex(bnd => bnd.eventName === type) !== -1);
  }

  findSagaHandlers(type: string) {
    return this._sagaDefinitions.filter(def => def.startByEvents.findIndex(bnd => bnd.eventName === type) !== -1);
  }
}
