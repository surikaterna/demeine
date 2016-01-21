var util=require('util');
var Aggregate = require('../..').Aggregate;

var Location = function(commandSink, eventHandler) {
  this.id = 1
	Aggregate.call(this, commandSink, eventHandler);
}

util.inherits(Location, Aggregate);

Location.prototype.changeName = function(newName) {
	this._sink({type:'location.change_name.command', payload:newName, aggregateId: 1 });
};

Location.prototype.processChangename = function(command) {
	this._apply({type:'location.changed_name.event', payload:command.payload, aggregateId: 1}, true);
};

Location.prototype.applyChangedname = function(event) {
	//change local state if necessary for validation
};

module.exports = Location;
