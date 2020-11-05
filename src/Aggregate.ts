import Queue from './Queue';
import { v4 as uuid } from 'uuid';
import Event from './Event';
import EventHandler from './EventHandler';
import CommandHandler from './CommandHandler';

import DefaultEventHandler from './DefaultEventHandler';
import DefaultCommandHandler from './DefaultCommandHandler';
import CommandSink from './CommandSink';

const LOG = require('slf').Logger.getLogger('demeine:aggregate');

function makePromise(promise: Promise<any>, warning: string) {
  let result: Promise<any> = promise;
  if (!result || !result.then) {
    LOG.warn(warning || 'not returning promise as expected');
    result = Promise.resolve(true);
  }
  return result;
}

export interface Command {
  id?: string;
  type: string;
  aggregateId: string;
  aggregateType?: string;
  payload: any;
}

class DummySink<StateType> implements CommandSink {
  _aggregate: Aggregate<StateType>;

  constructor(aggregate: Aggregate<any>) {
    this._aggregate = aggregate;
  }

  sink(command: Command) {
    return this._aggregate._process(command);
  }
}

export default abstract class Aggregate<StateType> {
  id: string = ''; // aggregate id
  type?: string; // aggregate type

  _uncommittedEvents: Event[] = [];
  _commandSink: CommandSink;
  _eventHandler: EventHandler;
  _commandHandler: CommandHandler;
  _version: number = 0;
  _commandQueue: Queue = new Queue();
  abstract _state: StateType;

  constructor(commandSink?: CommandSink, eventHandler?: EventHandler, commandHandler?: CommandHandler) {
    this._uncommittedEvents = [];
    this._commandSink = commandSink || new DummySink(this);
    this._eventHandler = eventHandler || new DefaultEventHandler();
    this._commandHandler = commandHandler || new DefaultCommandHandler();
  }

  _rehydrate(events: any[], version: number, snapshot?: StateType) {
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

  _apply(event: Event, isNew: boolean = false) {
    LOG.debug('applying event %j %s', event, isNew);

    if (!event.id) {
      event.id = uuid();
    }
    // eslint-disable-next-line
    if (!event.type || !event.aggregateId || event.aggregateId != this.id) {
      LOG.error('event is missing data %j', event);
      throw new Error(`event is missing data ${JSON.stringify(event)}`);
    }
    this._eventHandler.handle(this, event);
    if (this._version === -1) {
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
  }

  _process(command: Command) {
    LOG.info('processing command %j', command);
    return new Promise((resolve, reject) => {
      try {
        const handler = this._commandHandler.handle(this, command);
        resolve(handler);
      } catch (error) {
        reject(error);
      }
    }).catch((error: any) => {
      LOG.error('Failed to process command %j', command, error);
      this.clearUncommittedEvents();
      throw error;
    });
  }

  _sink(commandToSink: Command | Promise<Command>) {
    LOG.info('sinking command %j', commandToSink);
    return this._commandQueue.queueCommand(() => {
      let thenned = Promise.resolve(commandToSink);
      thenned = thenned.then((command: Command) => {
        if (!command.id) {
          LOG.warn('No command id set, setting it automatiically');
          command.id = uuid();
        }
        // console.log(command.aggregateId + " || " + self.id);
        // eslint-disable-next-line
        if (!command.type || !command.aggregateId || command.aggregateId != this.id) {
          const error = new Error('command is missing data ' + JSON.stringify(command));
          LOG.error('Unable to sink command %j', command);
          throw error;
        }
        if (this.type) {
          command.aggregateType = this.type;
        }
        const result = this._commandSink.sink(command, this);
        return makePromise(result, 'sinking command but not returning promise, commands status and chaining might not work as expected');
      });
      // console.log('thenn', thenned);
      return thenned;
    });
  }

  getVersion() {
    return this._version;
  }

  getUncommittedEvents(): Event[] {
    // throw if async cmd is on queue
    if (this._commandQueue.isProcessing()) {
      throw new Error('Cannot get uncommitted events while there is still commands in queue - try using getUncommittedEventsAsync()');
    }
    return this._uncommittedEvents;
  }

  getUncommittedEventsAsync(): Promise<Event[]> {
    return this._commandQueue.empty().then(() => {
      if (this._commandQueue.isProcessing()) {
        return this.getUncommittedEventsAsync();
      }
      return this.getUncommittedEvents();
    });
  }

  clearUncommittedEvents() {
    LOG.info('Clearing uncommitted events');
    return (this._uncommittedEvents = []);
  }
}
