var util=require('util');
var Aggregate = require('../..').Aggregate;
var Promise = require('bluebird');

var Location = function(commandSink, eventHandler) {
  this.id = 1
	Aggregate.call(this, commandSink, eventHandler);
}

util.inherits(Location, Aggregate);



// --------- CHANGE NAME

Location.prototype.changeName = function(newName) {
	return this._sink({type:'location.change_name.command', payload:newName, aggregateId: 1 });
};

Location.prototype.processChangeName = function(command) {
	return this._apply({type:'location.changed_name.event', payload:command.payload, aggregateId: 1}, true);
};

Location.prototype.applyChangedName = function(event) {
	//change local state if necessary for validation
};



// --------- CHANGE NAME (PROMISE)

Location.prototype.changeNameAsync = function(newName) {
  var promise = new Promise(function (resolve, reject) {
    setTimeout(function () {
      resolve({type: 'location.change_name.command', payload: newName, aggregateId: 1 })
    }, 50)
  });
	return this._sink(promise);
};

Location.prototype.processChangeNameAsync = function(command) {
	return this._apply({type:'location.changed_name.event', payload:command.payload, aggregateId: 1}, true);
};

Location.prototype.applyChangedNameAsync = function(event) {
	//change local state if necessary for validation
};



// --------- FAIL NAME

Location.prototype.failName = function(newName) {
	return this._sink({type:'location.fail_name.command', payload:newName, aggregateId: 1 });
};

Location.prototype.processFailName = function(command) {
  var self = this;
  console.log('PROCESS');
  if(command.payload === 'fail early') {
    throw new Error('Failing early');
  }
	return new Promise(function(resolve, reject) {
    self._apply({type:'location.changed_name.event', payload:command.payload, aggregateId: 1}, true);
    reject(new Error('uh oh'))
  });
};

Location.prototype.applyFailedName = function(event) {
	//change local state if necessary for validation
};


module.exports = Location;
