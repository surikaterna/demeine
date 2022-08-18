import Promise from 'bluebird';
import { Aggregate } from '../Aggregate';
import { Command, CommandSink, Event, EventHandler } from '../Aggregate.interfaces';

interface LocationState {
  name?: string;
}

export interface RegisterNamePayload {
  name: string;
}

export class Location extends Aggregate<LocationState> {
  constructor(commandSink?: CommandSink, eventHandler?: EventHandler) {
    super(commandSink, eventHandler);
    this.id = '1';
    this._state = {} as LocationState;
  }

  registerName(newName: string) {
    return this._sink({
      type: 'location.register_name.command',
      payload: { name: newName },
      aggregateId: '1'
    });
  }

  processRegisterName(command: Command<RegisterNamePayload>) {
    return this._apply({
      type: 'location.registered_name.event',
      payload: command.payload,
      aggregateId: '1'
    }, true);
  }

  applyRegisteredName(event: Event<RegisterNamePayload>) {
    this._state.name = event.payload.name;
  }

  changeName(newName: string) {
    return this._sink({
      type: 'location.change_name.command',
      payload: { name: newName },
      aggregateId: '1'
    });
  }

  processChangeName(command: Command<RegisterNamePayload>) {
    return this._apply({
      type: 'location.changed_name.event',
      payload: command.payload,
      aggregateId: '1'
    }, true);
  }

  applyChangedName(event: Event<RegisterNamePayload>) {
    //change local state if necessary for validation
    if (!this._state.name) {
      throw new Error('Should have name in order to change it!');
    }
    this._state.name = event.payload.name;
  }

  changeNameAsync(newName: string) {
    const promise = new Promise<Command<RegisterNamePayload>>((resolve) => {
      setTimeout(() => {
        resolve({
          type: 'location.change_name.command',
          payload: { name: newName },
          aggregateId: '1'
        });
      }, 50);
    });
    return this._sink(promise);
  }

  processChangeNameAsync(command: Command<RegisterNamePayload>) {
    return this._apply({
      type: 'location.changed_name.event',
      payload: command.payload,
      aggregateId: '1'
    }, true);
  }

  applyChangedNameAsync(event: Event<RegisterNamePayload>) {
    this._state.name = event.payload.name;
  }

  failName(newName: string) {
    return this._sink({
      type: 'location.fail_name.command',
      payload: { name: newName },
      aggregateId: '1'
    });
  }

  processFailName(command: Command<RegisterNamePayload>) {
    if (command.payload.name === 'fail early') {
      throw new Error('Failing early');
    }
    return new Promise((resolve, reject) => {
      this._apply({
        type: 'location.changed_name.event',
        payload: command.payload,
        aggregateId: '1'
      }, true);
      reject(new Error('uh oh'));
    });
  }

  applyFailedName(event: Event<RegisterNamePayload>) {
    //change local state if necessary for validation
  }
}
