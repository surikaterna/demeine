/* eslint-disable */
import { Aggregate } from '..';
import CommandSink from '../CommandSink';
import EventHandler from '../EventHandler';
import { Command } from '../Aggregate';
import Event from '../Event';
import Message from './Message';
import { v4 as uuid } from 'uuid';
import CommandHandler from '../CommandHandler';

const LOG = require('slf').Logger.getLogger('demeine:saga');

interface SagaAggregateState {
  eventIds: string[];
}

interface TimeDefinition {}
class RegisterIncomingEvent implements Command {
  type = 'saga.incoming_event.register';
  aggregateId = '12';
  payload: Event;
  constructor(event: Event) {
    this.payload = event;
  }
}

interface AggregateCommandHandler<S, C extends Command, E extends Event> {
  processCommand(state: S, cmd: C): E | Promise<E> | E[] | Promise<E[]>;
}

interface AggregateEventHandler<E extends Event, S> {
  applyEvent(state: S, event: E): S;
}

interface AggregateProcessor<S, C extends Command, E extends Event> extends AggregateCommandHandler<S, C, E>, AggregateEventHandler<E, S> {}

interface Entity<T> {
  id: T;
}

const CreateOnEvent = (type: string, id?: any): Function => {
  return () => {};
};

// @CreateOnEvent('RegisterOrderLine', (event: any) => event.payload.id)
class OrderLine implements Entity<string> {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

interface EventUpgrader {
  upgrade(e: Event): Event | Event[];
}

function entity(e: Function): any {
  return e;
}

class OrderState {
  id: string = '';

  @entity
  lines: OrderLine[] = [];
}

class Order {}

class Chand implements AggregateProcessor<RegisterIncomingEvent, Event, any> {
  // @ForCommand('')
  processCommand(state: any, cmd: RegisterIncomingEvent): Event {
    return { aggregateId: '1', payload: {}, type: 'ee', id: uuid() };
  }
  applyEvent(state: any, event: Event): any {
    return undefined;
  }
  // @ForEvent('')
  // applyEvent()
}

abstract class AggregateWithHandlers<S> extends Aggregate<S> {
  /*  protected constructor(handlers: AggregateProcessorConstructor) {
      super();
    }
  */
}

export default class SagaAggregate extends Aggregate<SagaAggregateState> {
  _state: SagaAggregateState;

  constructor(commandSink?: CommandSink, eventHandler?: EventHandler, commandHandler?: CommandHandler) {
    super(commandSink, eventHandler, commandHandler);
    this._state = { eventIds: [] };
  }

  incomingEvent(event: Event) {
    return this._sink(new RegisterIncomingEvent(event));
  }

  processIncomingEvent(cmd: RegisterIncomingEvent) {
    return this._apply(new IncomingEventRegistered());
  }

  applyIncomingEvent(event: Event) {
    //We do not allow the same event to be applied twice
    if (this._state.eventIds.includes(event.id)) {
      LOG.error('Event %i already applied for Saga %i', event.id, this.id);
      throw new Error(`Event ${event.id} already applied for Saga ${this.id}`);
    }
  }

  outgoingCommand(command: Command) {}

  //process

  dispatchMessage(message: Message) {}

  /*scheduleMessage(at: TimeDefinition, message: Message) {

  }
  */

  timeout(at: TimeDefinition, handler: string, payload: object) {}
}
