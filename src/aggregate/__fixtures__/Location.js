import { Aggregate } from '../../aggregate/Aggregate';
import Promise from 'bluebird';

export class Location extends Aggregate {
  constructor(commandSink, eventHandler) {
    super(commandSink, eventHandler);
    this.id = 1;
    this._state = {};
  }

  registerName(newName) {
    return this._sink({ type: 'location.register_name.command', payload: newName, aggregateId: 1 });
  }

  processRegisterName(command) {
    return this._apply({ type: 'location.registered_name.event', payload: command.payload, aggregateId: 1 }, true);
  }

  applyRegisteredName(event) {
    this._state.name = event.payload;
  }

  changeName(newName) {
    return this._sink({ type: 'location.change_name.command', payload: newName, aggregateId: 1 });
  }

  processChangeName(command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
  }

  applyChangedName(event) {
    //change local state if necessary for validation
    if (!this._state.name) {
      throw new Error('Should have name in order to change it!');
    }
    this._state.name = event.payload;
  }

  changeNameAsync(newName) {
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ type: 'location.change_name.command', payload: newName, aggregateId: 1 });
      }, 50);
    });
    return this._sink(promise);
  }

  processChangeNameAsync(command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
  }

  applyChangedNameAsync(event) {
    this._state.name = event.payload;
  }

  failName(newName) {
    return this._sink({ type: 'location.fail_name.command', payload: newName, aggregateId: 1 });
  }

  processFailName(command) {
    if (command.payload === 'fail early') {
      throw new Error('Failing early');
    }
    return new Promise((resolve, reject) => {
      this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
      reject(new Error('uh oh'));
    });
  }

  applyFailedName(event) {
    //change local state if necessary for validation
  }
}
