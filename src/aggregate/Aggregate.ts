import { Command, Event } from '@surikat/core-domain';
import { CommandHandler, DefaultCommandHandler, DefaultEventHandler, EventHandler } from 'handlers';
import { LoggerFactory } from 'slf';
import { v4 as uuid } from 'uuid';
import { Queue } from '../queue';

const LOG = LoggerFactory.getLogger('demeine:aggregate');

export interface ApplyFunc<State extends BaseState = BaseState> {
  <Payload>(event: Event<Payload>, isNew?: boolean): Aggregate<State>;
}

export interface BaseState {
  id: string;
}

export type CommandSink<State extends BaseState = BaseState> = {
  sink<Payload = unknown>(command: Command<Payload>, aggregate: Aggregate<State>): Promise<Promise<Aggregate<State>>>
}

export interface ProcessFunc<State extends BaseState = BaseState> {
  <Payload>(command: Command<Payload>): Promise<Promise<Aggregate<State>>>;
}

export class Aggregate<State extends BaseState = BaseState> {
  id!: string;
  _version: number;
  _state!: State;
  type?: string;

  private readonly commandHandler: CommandHandler;
  private readonly commandQueue: Queue;
  private readonly commandSink: CommandSink<State>;
  private readonly eventHandler: EventHandler;
  private version: number;
  private uncommittedEvents: Array<Event<unknown>>;

  constructor(commandSink?: CommandSink<State>, eventHandler?: EventHandler,
    commandHandler?: CommandHandler) {
    this.uncommittedEvents = [];

    this.commandSink = commandSink ?? {
      sink: <Payload = unknown>(command: Command<Payload>, _aggregate: Aggregate<State>) => this._process(command)
    };

    this.eventHandler = eventHandler ?? new DefaultEventHandler();
    this.commandHandler = commandHandler ?? new DefaultCommandHandler();
    this.version = 0;
    this._version = 0; // TODO: I added this to make sure aggregate always has a _version. Used in repository.save. Keep?
    this.commandQueue = new Queue();
  }

  clearUncommittedEvents = (): Array<Event<unknown>> => {
    LOG.info('Clearing uncommitted events');
    return this.uncommittedEvents = [];
  };

  getVersion = (): number => this.version;

  getUncommittedEvents = (): Array<Event<unknown>> => {
    if (this.commandQueue.isProcessing()) {
      throw new Error(
        'Cannot get uncommitted events while there is still commands in queue - try using getUncommittedEventsAsync()');
    }

    return this.uncommittedEvents;
  };

  getUncommittedEventsAsync = async (): Promise<Array<Event<unknown>>> => {
    await this.commandQueue.empty();
    return this.commandQueue.isProcessing()
      ? this.getUncommittedEventsAsync()
      : this.getUncommittedEvents();
  };

  getSnapshot = () => this._state;

  _apply: ApplyFunc<State> = <Payload = unknown>(event: Event<Payload>, isNew = false): Aggregate<State> => {
    LOG.debug('applying event %j %b', event, isNew);

    if (!event.id) {
      event.id = uuid();
    }

    if (!event.type || !event.aggregateId || event.aggregateId !== this.id) {
      throw new Error(`event is missing data ${event}`);
    }

    this.eventHandler.handle(this, event);

    if (this.version === -1) {
      this.version = 0;
    }

    this.version++;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }

    return this;
  };

  _process: ProcessFunc<State> = <Payload = unknown>(command: Command<Payload>): Promise<Promise<Aggregate<State>>> => {
    LOG.info('processing command %j', command);

    return new Promise((resolve, reject) => {
      try {
        resolve(this.commandHandler.handle(this, command));
      } catch (error) {
        LOG.error('Failed to process command %j', command, error);
        this.clearUncommittedEvents();

        reject(error);
      }
    });
  };

  _rehydrate = (events: Array<Event<unknown>>, version: number, snapshot?: State) => {
    LOG.info(
      'rehydrating aggregate with %d events to version %d has snapshot %b',
      events.length,
      version,
      snapshot !== undefined
    );

    if (snapshot) {
      this._state = snapshot;
    }

    for (let i = 0; i < events.length; i++) {
      this._apply(events[i], false);
    }

    this.version = version ?? this.version;
  };

  _sink = <Payload = unknown>(commandToSink: Command<Payload> | Promise<Command<Payload>>) => {
    LOG.info('sinking command %j', commandToSink);

    return this.commandQueue.queueCommand(() => Promise.resolve(commandToSink).then(async (command) => {
      if (!command.id) {
        LOG.warn('No command id set, setting it automatically');
        command.id = uuid();
      }

      if (!command.type || !command.aggregateId || command.aggregateId !== this.id) {
        const error = new Error(`command is missing data ${JSON.stringify(command)}`);
        LOG.error('Unable to sink command %j', error);
        throw error;
      }

      if (this.type) {
        command.aggregateType = this.type;
      }

      const result = await this.commandSink.sink(command, this);
      return promise(
        result,
        'sinking command but not returning promise, commands status and chaining might not work as expected'
      );
    }));
  };
}

type MaybePromiseLike<Type> = Type | PromiseLike<Type>;

function isPromiseLike<Type>(value: MaybePromiseLike<Type>): value is PromiseLike<Type> {
  return Boolean((value as PromiseLike<Type>)?.then);
}

function promise<Result>(result: MaybePromiseLike<Result>, warning?: string): PromiseLike<Result> {
  if (!isPromiseLike(result)) {
    LOG.warn(warning || 'not returning promise as expected');
    return Promise.resolve(result);
  }

  return result;
}

export default Aggregate;
