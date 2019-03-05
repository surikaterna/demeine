import { Aggregate } from '../..';
import EventHandler from '../../src/EventHandler';
import CommandSink from '../../src/CommandSink';
import { Command } from '../../src/Aggregate';
import Event from '../../src/Event';
// var Promise = require('bluebird');
export interface LocationState {
  name: string
}

export default class Location extends Aggregate<LocationState> {
  _state: LocationState = { name: '' }
  constructor(commandSink?: CommandSink, eventHandler?: EventHandler) {
    super(commandSink, eventHandler);
    this.id = '1'
  }

  // --------- CHANGE NAME

  changeName(newName: string) {
    return this._sink({ type: 'location.change_name.command', payload: newName, aggregateId: '1' });
  };

  processChangeName(command: Command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: '1' }, true);
  };

  applyChangedName(event: Event) {
    //change local state if necessary for validation
    this._state.name = event.payload;
  };



  // --------- CHANGE NAME (PROMISE)

  changeNameAsync(newName: string) {
    const promise = new Promise<Command>(function (resolve, reject) {
      setTimeout(function () {
        resolve({ type: 'location.change_name.command', payload: newName, aggregateId: '1' })
      }, 50)
    });
    return this._sink(promise);
  };

  processChangeNameAsync(command: Command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: '1' }, true);
  };

  applyChangedNameAsync(event: Event) {
    this._state.name = event.payload;
  };



  // --------- FAIL NAME

  failName(newName: string) {
    return this._sink({ type: 'location.fail_name.command', payload: newName, aggregateId: '1' });
  };

  processFailName(command: Command) {
    var self = this;
    if (command.payload === 'fail early') {
      throw new Error('Failing early');
    }
    return new Promise(function (resolve, reject) {
      self._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: '1' }, true);
      reject(new Error('uh oh'))
    });
  };

  applyFailedName(event: Event) {
    //change local state if necessary for validation
  };
}
