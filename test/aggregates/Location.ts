var Aggregate = require('../..').Aggregate;
// var Promise = require('bluebird');

export default class Location extends Aggregate<object> {

  constructor(commandSink, eventHandler) {
    super(commandSink, eventHandler);
    this.id = 1
    this._state = {};
  }

  // --------- CHANGE NAME

  changeName(newName) {
    return this._sink({ type: 'location.change_name.command', payload: newName, aggregateId: 1 });
  };

  processChangeName(command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
  };

  applyChangedName(event) {
    //change local state if necessary for validation
    this._state.name = event.payload;
  };



  // --------- CHANGE NAME (PROMISE)

  changeNameAsync(newName) {
    var promise = new Promise(function (resolve, reject) {
      setTimeout(function () {
        resolve({ type: 'location.change_name.command', payload: newName, aggregateId: 1 })
      }, 50)
    });
    return this._sink(promise);
  };

  processChangeNameAsync(command) {
    return this._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
  };

  applyChangedNameAsync(event) {
    this._state.name = event.payload;
  };



  // --------- FAIL NAME

  failName(newName) {
    return this._sink({ type: 'location.fail_name.command', payload: newName, aggregateId: 1 });
  };

  processFailName(command) {
    var self = this;
    if (command.payload === 'fail early') {
      throw new Error('Failing early');
    }
    return new Promise(function (resolve, reject) {
      self._apply({ type: 'location.changed_name.event', payload: command.payload, aggregateId: 1 }, true);
      reject(new Error('uh oh'))
    });
  };

  applyFailedName(event) {
    //change local state if necessary for validation
  };
}
