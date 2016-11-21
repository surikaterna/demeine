var util = require('util');
var Queue = require('./queue');
var Promise = require('bluebird');
var uuid = require('node-uuid').v4;

var DefaultEventHandler = require('./default_event_handler');
var DefaultCommandHandler = require('./default_command_handler');

var LOG = require('slf').Logger.getLogger('demeine:aggregate');

function _promise(result, warning) {
  if (!result || !result.then) {
    LOG.warn(warning || 'not returning promise as expected');
    result = Promise.resolve(true);
  }
  return result;
}

var Aggregate = function (commandSink, eventHandler, commandHandler) {
  var self = this;
  this._uncommittedEvents = [];
  this._commandSink = commandSink || new function () { this.sink = function (cmd) { return self._process(cmd) } };
  this._eventHandler = eventHandler || new DefaultEventHandler();
  this._commandHandler = commandHandler || new DefaultCommandHandler();
  this._version = 0;
  this._commandQueue = new Queue();
};

Aggregate.prototype._rehydrate = function (events, version) {
  LOG.info('rehydrating aggregate with %d events to version %d', events.length, version);
  for (var i = 0; i < events.length; i++) {
    this._apply(events[i], false);
  }
  this._version = version || this._version;
};

Aggregate.prototype._apply = function (event, isNew) {
  LOG.debug('applying event %j %s', event, isNew);

  if (!event.id) {
    event.id = uuid();
  }
  if (!event.type || !event.aggregateId || event.aggregateId != this.id) {
    console.log(this);
    console.log(event);
    throw new Error('event is missing data', event);
  }
  this._eventHandler.handle(this, event);
  if (this._version == -1) {
    this._version = 0;
  }

  this._version++;
  if (isNew) {
    this._uncommittedEvents.push(event);
  } /*else {
		if(!this._committedEvents) {
			this._committedEvents =[];
		}
		this._committedEvents.push(event);
	}*/
  return this;
};

Aggregate.prototype._process = function (command) {
  LOG.info('processing command %j', command);
  var self = this;
  return new Promise(function (resolve, reject) {
    try {
      resolve(self._commandHandler.handle(self, command));
    } catch (error) {
      reject(error);
    }
  }).error(function (error) {
    LOG.error('Failed to process command %j', command, error);
    self.clearUncommittedEvents();
    throw error;
  });
};


Aggregate.prototype._sink = function (commandToSink) {
  LOG.info('sinking command %j', commandToSink);
  var self = this;
  return this._commandQueue.queueCommand(function() {
    var result = null;
    if(!commandToSink.then) {
      result = {then:function(a) {
        a(commandToSink);
      }}
    } else {
      result = commandToSink;
    }
    return result.then(function(command) {
      if (!command.id) {
        LOG.warn('No command id set, setting it automatiically');
        command.id = uuid();
      }
      //console.log(command.aggregateId + " || " + this.id + " || " + this._state.id);
      if (!command.type || !command.aggregateId || command.aggregateId != self.id) {
        console.log(command);
        var error = new Error('command is missing data', command);
        LOG.error('Unable to sink command', error);
        throw error;
      }
      if (self.type) {
        command.aggregateType = self.type;
      }
      var result = self._commandSink.sink(command, self);
      return _promise(result, 'sinking command but not returning promise, commands status and chaining might not work as expected');
    });
/*    if (command instanceof Promise) {
      return self._sinkPromised(command);
    }
*/

  });
};

Aggregate.prototype._sinkPromised = function (promise) {
  console.log('sinking promise...');
  var self = this;
  return promise
    .then(function (res) {
      return self._sink(res);
    })
    .error(function (err) {
      var error = new Error('failed to resolve promise-based command', err);
      LOG.error('failed to resolve promise-based command', error);
      throw error;
    });
};

Aggregate.prototype.getVersion = function () {
  return this._version;
};

Aggregate.prototype.getUncommittedEvents = function () {
  // TODO !!!!
  //throw if async cmd is on process (cmdQueue.inProcess())
  return this._uncommittedEvents;
}

Aggregate.prototype.getUncommittedEventsAsync = function() {
  var self = this;
  // TODO !!!
  return this._cmdQueue.empty().then(function() {
    return self.getUncommittedEvents();
  })
}

Aggregate.prototype.clearUncommittedEvents = function () {
  LOG.info('Clearing uncommitted events');
  return this._uncommittedEvents = [];
}

module.exports = Aggregate;
