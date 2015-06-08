var DefaultEventHandler = require('./default_event_handler');
var DefaultCommandHandler = require('./default_command_handler');

var Aggregate = function(commandSink, eventHandler, commandHandler) {
	var self = this;
	this._uncommittedEvents = [];
	this._commandSink = commandSink || new function() { this.sink = function(cmd) { self._process(cmd)}};
	this._eventHandler = eventHandler || new DefaultEventHandler();
	this._commandHandler = commandHandler || new DefaultCommandHandler();
	this._version = 0;
}


Aggregate.prototype._rehydrate = function(events, version) {
	for(var i=0; i<events.length; i++) {
		this._apply(events[i], false);
	}
	this._version = version || this._version;
};

Aggregate.prototype._apply = function(event, isNew) {
	this._eventHandler.handle(this, event);
	if(this._version == -1) {
		this._version=0;
	}

	this._version++;
	if(isNew) {
		this._uncommittedEvents.push(event);
	}
};

Aggregate.prototype._process = function(command) {
	this._commandHandler.handle(this, command);
};

Aggregate.prototype._sink = function(command) {
	this._commandSink.sink(command, this);
}


Aggregate.prototype.getVersion = function() {
	return this._version;
};

Aggregate.prototype.getUncommittedEvents = function() {
	return this._uncommittedEvents;
}

Aggregate.prototype.clearUncommittedEvents = function() {
	return this._uncommittedEvents = [];
}



module.exports = Aggregate;