var util = require('util');
var Queue = require('./queue');
var Promise = require('bluebird');
var uuid = require('uuid').v4;

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
  this._commandSink =
    commandSink ||
    new (function () {
      this.sink = function (cmd) {
        return self._process(cmd);
      };
    })();
  this._eventHandler = eventHandler || new DefaultEventHandler();
  this._commandHandler = commandHandler || new DefaultCommandHandler();
  this._version = 0;
  this._commandQueue = new Queue();
};

Aggregate.prototype._rehydrate = function (events, version, snapshot) {
  LOG.info('rehydrating aggregate with %d events to version %d has snapshot %s', events.length, version, snapshot !== undefined);
  // do another way?
  if (snapshot) {
    this._state = snapshot;
  }
  for (var i = 0; i < events.length; i++) {
    this._apply(events[i], false);
  }
  this._version = version || this._version;
};

Aggregate.prototype._getSnapshot = function () {
  return this._state;
};

Aggregate.prototype._apply = function (event, isNew) {
  LOG.debug('applying event %j %s', event, isNew);

  if (!event.id) {
    event.id = uuid();
  }
  if (!event.type || !event.aggregateId || event.aggregateId != this.id) {
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
      var handler = self._commandHandler.handle(self, command);
      resolve(handler);
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
  return this._commandQueue.queueCommand(function () {
    var thenned = Promise.resolve(commandToSink);
    thenned = thenned.then(function (command) {
      if (!command.id) {
        LOG.warn('No command id set, setting it automatiically');
        command.id = uuid();
      }
      if (!command.type || !command.aggregateId || command.aggregateId != self.id) {
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
    return thenned;
  });
};

/**
 * Built in functionality to manage deletion of Aggregates / streams
 */
Aggregate.prototype.delete = function () {
  return this._sink({ type: '$stream.delete.command', aggregateId: this.id, payload: {} });
};

Aggregate.prototype.processDelete = function () {
  return this._apply(
    {
      type: '$stream.deleted.event',
      aggregateId: this.id,
      payload: {
        aggregateType: this.aggregateType
      }
    },
    true
  );
};
Aggregate.prototype.applyDeleted = function () {};

Aggregate.prototype.getVersion = function () {
  return this._version;
};

Aggregate.prototype.getUncommittedEvents = function () {
  //throw if async cmd is on queue
  if (this._commandQueue.isProcessing()) {
    throw new Error('Cannot get uncommitted events while there is still commands in queue - try using getUncommittedEventsAsync()');
  }
  return this._uncommittedEvents;
};

Aggregate.prototype.getUncommittedEventsAsync = function () {
  var self = this;
  return self._commandQueue.empty().then(function () {
    if (self._commandQueue.isProcessing()) {
      return self.getUncommittedEventsAsync();
    } else {
      return self.getUncommittedEvents();
    }
  });
};

Aggregate.prototype.clearUncommittedEvents = function () {
  LOG.info('Clearing uncommitted events');
  return (this._uncommittedEvents = []);
};

module.exports = Aggregate;
