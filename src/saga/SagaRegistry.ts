import Saga from './Saga';
import Message from './Message';

interface SagaBinding {
  eventName: string;
  eventHandler: Function;
}

interface SagaConstructor {
  new () : Saga<any>;
}

class SagaDefinition {
  sagaConstructor?: SagaConstructor;
  startByEvents: SagaBinding[] = [];
  handlesEvents: SagaBinding[] = [];
  // lookup by
}

class SagaBinder {
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

class SagaService {
  private _registry: SagaRegistry;

  constructor(registry: SagaRegistry) {
    this._registry = registry;
  }

  async onMessage(msg: Message) {
    const startSagas = this._registry.findSagaStarters(msg.type);

    startSagas.forEach(async (def) => {
      // Is there an old instance;
      let sagaInstance = await this._loadSaga(def, msg);
      if(!sagaInstance) {
        sagaInstance = def.sagaConstructor && new def.sagaConstructor();
      }
      const handler = def.startByEvents.find(binding => binding.eventName === msg.type);

      if (handler !== undefined) {
        handler.eventHandler.call(sagaInstance, msg);
      }

    });

  }
  _loadSaga(sagaDeef: SagaDefinition, msg: Message): Promise<Saga<any> | undefined> {

    return Promise.resolve(undefined);
  }
}

export default class SagaRegistry {
  private _sagaDefinitions: SagaDefinition[] = [];

  register(sagaDefinition: SagaDefinition) {
    this._sagaDefinitions.push(sagaDefinition);
  }

  findSagaStarters(type: string) {
    return this._sagaDefinitions.filter(def => def.startByEvents.findIndex((bnd => (bnd.eventName === type))) !== -1);
  }

  findSagaHandlers(type: string) {
    return this._sagaDefinitions.filter(def => def.startByEvents.findIndex((bnd => (bnd.eventName === type))) !== -1);
  }
}
