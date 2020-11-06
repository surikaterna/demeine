import Message from './Message';
import Saga from './Saga';
import SagaRegistry from './SagaRegistry';
import { SagaDefinition } from './SagaDefinition';

export default class SagaService {
  private _registry: SagaRegistry;

  constructor(registry: SagaRegistry) {
    this._registry = registry;
  }

  async onMessage(msg: Message) {
    const startSagas = this._registry.findSagaStarters(msg.type);

    startSagas.forEach(async def => {
      // Is there an old instance;
      let sagaInstance = await this.loadSaga(def, msg);
      if (!sagaInstance) {
        sagaInstance = def.sagaConstructor && new def.sagaConstructor();
      }
      const handler = def.startByEvents.find(binding => binding.eventName === msg.type);

      if (handler !== undefined) {
        handler.eventHandler.call(sagaInstance, msg);
      }
    });
  }

  // @ts-ignore
  private loadSaga(sagaDef: SagaDefinition, msg: Message): Promise<Saga<any> | undefined> {
    return Promise.resolve(undefined);
  }
}
