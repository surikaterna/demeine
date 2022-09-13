import { getMessageFromError } from '../utils/errorUtils';
import { Command, CommandHandler, CommandSink, Event, EventHandler } from './Aggregate.interfaces';
import { Queue } from '../queue/Queue';
import Promise from 'bluebird';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'uuid';
import { DefaultEventHandler } from './DefaultEventHandler';
import { DefaultCommandHandler } from './DefaultCommandHandler';

const LOG = LoggerFactory.getLogger('demeine:aggregate');
type MaybePromise<T> = T | Promise<T>;

function _promise<T>(result?: globalThis.Promise<T>, warning?: string): globalThis.Promise<T | true> {
  if (!result?.then) {
    LOG.warn(warning || 'not returning promise as expected');
    return Promise.resolve(true);
  }
  return result;
}

export class Aggregate<State extends object = object> {
  id: string;
  type?: string;
  _uncommittedEvents: Array<Event>;
  _commandHandler: CommandHandler;
  _commandSink: CommandSink<State>;
  _eventHandler: EventHandler;
  _version: number;
  _commandQueue: Queue;
  _state: State;

  constructor(commandSink?: CommandSink<State>, eventHandler?: EventHandler, commandHandler?: CommandHandler) {
    this._uncommittedEvents = [];
    this._commandSink = commandSink || ({
      sink: (cmd: Command) => {
        return this._process(cmd);
      }
    });
    this._eventHandler = eventHandler || new DefaultEventHandler();
    this._commandHandler = commandHandler || new DefaultCommandHandler();
    this._version = 0;
    this._commandQueue = new Queue();
    this._state = {} as State;
    this.id = uuid();
  }

  _rehydrate(events: Array<Event>, version?: number, snapshot?: State): void {
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

  _getSnapshot(): State | undefined {
    return this._state;
  }

  _apply(event: Event, isNew?: boolean): Aggregate<State> {
    LOG.debug('applying event %j %s', event, isNew);

    if (!event.id) {
      event.id = uuid();
    }
    if (!event.type || !event.aggregateId || event.aggregateId != this.id) {
      throw new Error(`event is missing data: ${JSON.stringify(event)}`);
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

  _process(command: Command): Promise<Aggregate<State>> {
    LOG.info('processing command %j', command);
    return new Promise((resolve, reject) => {
      try {
        const handler = this._commandHandler.handle(this, command);
        resolve(handler);
      } catch (error) {
        reject(error);
      }
    }).error((error) => {
      LOG.error('Failed to process command %j. Error: %s', command, getMessageFromError(error));
      this.clearUncommittedEvents();
      throw error;
    });
  }

  _sink(commandToSink: MaybePromise<Command>): globalThis.Promise<Aggregate<State> | true> {
    LOG.info('sinking command %j', commandToSink);
    return this._commandQueue.queueCommand(() => {
      let resolvedCommand = Promise.resolve(commandToSink);
      const aggregatePromise = resolvedCommand.then((command) => {
        if (!command.id) {
          LOG.warn('No command id set, setting it automatiically');
          command.id = uuid();
        }
        if (!command.type || !command.aggregateId || command.aggregateId !== this.id) {
          const error = new Error(`command is missing data: ${JSON.stringify(command)}`);
          LOG.error('Unable to sink command. Error: %s', getMessageFromError(error));
          throw error;
        }
        if (this.type) {
          command.aggregateType = this.type;
        }
        const aggregate = this._commandSink.sink(command, this);
        return _promise(aggregate, 'sinking command but not returning promise, commands status and chaining might not work as expected');
      });
      return aggregatePromise;
    });
  }

  /**
   * Built in functionality to manage deletion of Aggregates / streams
   */
  delete() {
    return this._sink({ type: '$stream.delete.command', aggregateId: this.id, payload: {} });
  }

  processDelete(command: Command): Aggregate<State> {
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

  applyDeleted(): void {
  }

  getVersion(): number {
    return this._version;
  }

  getUncommittedEvents<Payload extends object = object>(): Array<Event<Payload>> {
    //throw if async cmd is on queue
    if (this._commandQueue.isProcessing()) {
      throw new Error('Cannot get uncommitted events while there is still commands in queue - try using getUncommittedEventsAsync()');
    }
    return this._uncommittedEvents as Array<Event<Payload>>;
  }

  getUncommittedEventsAsync<Payload extends object = object>(): globalThis.Promise<Array<Event<Payload>>> {
    return this._commandQueue.empty().then(() => {
      if (this._commandQueue.isProcessing()) {
        return this.getUncommittedEventsAsync<Payload>();
      } else {
        return this.getUncommittedEvents<Payload>();
      }
    });
  }

  clearUncommittedEvents(): Array<Event> {
    LOG.info('Clearing uncommitted events');
    return (this._uncommittedEvents = []);
  }
}
