import { Queue } from '../queue/Queue';
import Promise from 'bluebird';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'uuid';
import { DefaultEventHandler } from './DefaultEventHandler';
import { DefaultCommandHandler } from './DefaultCommandHandler';

const LOG = LoggerFactory.getLogger('demeine:aggregate');

function _promise(result, warning) {
  if (!result || !result.then) {
    LOG.warn(warning || 'not returning promise as expected');
    result = Promise.resolve(true);
  }
  return result;
}

export class Aggregate {
  constructor(commandSink, eventHandler, commandHandler) {
    this._uncommittedEvents = [];
    this._commandSink = commandSink || ({
      sink: (cmd) => {
        return this._process(cmd);
      }
    });
    this._eventHandler = eventHandler || new DefaultEventHandler();
    this._commandHandler = commandHandler || new DefaultCommandHandler();
    this._version = 0;
    this._commandQueue = new Queue();
  }

  _rehydrate(events, version, snapshot) {
    LOG.info('rehydrating aggregate with %d events to version %d has snapshot %s', events.length, version, snapshot !== undefined);
    // do another way?
    if (snapshot) {
      this._state = snapshot;
    }
    for (let i = 0; i < events.length; i++) {
      this._apply(events[i], false);
    }
    this._version = version || this._version;
  }

  _getSnapshot() {
    return this._state;
  }

  _apply(event, isNew) {
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
    }

    return this;
  }

  _process(command) {
    LOG.info('processing command %j', command);
    return new Promise((resolve, reject) => {
      try {
        const handler = this._commandHandler.handle(this, command);
        resolve(handler);
      } catch (error) {
        reject(error);
      }
    }).error((error) => {
      LOG.error('Failed to process command %j', command, error);
      this.clearUncommittedEvents();
      throw error;
    });
  }

  _sink(commandToSink) {
    LOG.info('sinking command %j', commandToSink);
    return this._commandQueue.queueCommand(() => {
      let thenned = Promise.resolve(commandToSink);
      thenned = thenned.then((command) => {
        if (!command.id) {
          LOG.warn('No command id set, setting it automatiically');
          command.id = uuid();
        }
        if (!command.type || !command.aggregateId || command.aggregateId != this.id) {
          const error = new Error('command is missing data', command);
          LOG.error('Unable to sink command', error);
          throw error;
        }
        if (this.type) {
          command.aggregateType = this.type;
        }
        const result = this._commandSink.sink(command, this);
        return _promise(result, 'sinking command but not returning promise, commands status and chaining might not work as expected');
      });
      return thenned;
    });
  }

  /**
   * Built in functionality to manage deletion of Aggregates / streams
   */
  delete() {
    return this._sink({ type: '$stream.delete.command', aggregateId: this.id, payload: {} });
  }

  processDelete(command) {
    return this._apply(
      {
        type: '$stream.deleted.event',
        aggregateId: this.id,
        correlationId: command.id,
        payload: {
          aggregateType: this.type
        }
      },
      true
    );
  }

  applyDeleted() {
  }

  getVersion() {
    return this._version;
  }

  getUncommittedEvents() {
    //throw if async cmd is on queue
    if (this._commandQueue.isProcessing()) {
      throw new Error('Cannot get uncommitted events while there is still commands in queue - try using getUncommittedEventsAsync()');
    }
    return this._uncommittedEvents;
  }

  getUncommittedEventsAsync() {
    return this._commandQueue.empty().then(() => {
      if (this._commandQueue.isProcessing()) {
        return this.getUncommittedEventsAsync();
      } else {
        return this.getUncommittedEvents();
      }
    });
  }

  clearUncommittedEvents() {
    LOG.info('Clearing uncommitted events');
    return (this._uncommittedEvents = []);
  }
}
