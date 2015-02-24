var util=require('util');
var Aggregate = require('../..').Aggregate;

var Location = function(commandSink, eventHandler) {
	Aggregate.call(this, commandSink, eventHandler);
}

util.inherits(Location, Aggregate);

Location.prototype.changeName = function(newName) {
	this._sink({type:'location.change_name.command', payload:newName});
};

Location.prototype.processChangeName = function(command) {
	this._apply({type:'location.changed_name.event', payload:command.payload}, true);
};

Location.prototype.applyChangedName = function(event) {
	//change local state if necessary for validation
};

module.exports = Location;