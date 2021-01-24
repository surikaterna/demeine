import { Command, Event } from '@surikat/core-domain';
import { Aggregate, BaseState, CommandSink } from '../../src/aggregate';
import { EventHandler } from '../../src/handlers';

export interface LocationState extends BaseState {
  name: string;
}

export class Location extends Aggregate<LocationState> {
  constructor(commandSink?: CommandSink<LocationState>, eventHandler?: EventHandler) {
    super(commandSink, eventHandler);

    this.id = '1';
    this._state = {} as LocationState;
  }

  registerName(newName: string) {
    /**
     * TODO: Update in core domain to only require these,
     * or update in Aggregate to pick required command properties?
     * Was initially as `Partial<Command> & Pick<Command, 'aggregateId' | 'payload' | 'type'>`
     * {
     *   type: 'location.register_name.command',
     *   payload: newName,
     *   aggregateId: 1
     * }
     *
     * Initially had aggregateId as number, but the type in core domain is set as string
     * Update in core domain? Or should we expect ID to be string, and update usages?
     * Can become pretty bothersome to have to type check aggregateId everywhere
     *
     * additionalInformation has to be set as optional anyway
     * Command should be typed as Command<Payload = unknown, AdditionalInformation = undefined>
     * Event should be typed as Event<Payload = unknown, AdditionalInformation = undefined>
     */

    return this._sink(new Command<string>('1', 'location.register_name.command', '1', newName));
  }

  processRegisterName(command: Command<string>) {
    /**
     * Same here with aggregateId failing by being a number. Was initially:
     * {
     *   type: 'location.registered_name.event',
     *   payload: command.payload,
     *   aggregateId: 1
     * }
     */
    return this._apply(
      new Event<string>('1', 'location.registered_name.event', command, command.payload),
      true
    );
  }

  applyRegisteredName(event: Event<string>) {
    this._state.name = event.payload;
  }

  changeName(newName: string) {
    return this._sink(new Command('1', 'location.change_name.command', '1', newName));
  }

  processChangeName(command: Command<string>) {
    return this._apply(
      new Event<string>('1', 'location.changed_name.event', command, command.payload),
      true
    );
  }

  applyChangedName(event: Event<string>) {
    // change local state if necessary for validation
    if (!this._state.name) {
      throw new Error('Should have name in order to change it!');
    }

    this._state.name = event.payload;
  }

  changeNameAsync(newName: string) {
    const promise = new Promise<Command<string>>((resolve) => setTimeout(() => {
      resolve(new Command('1', 'location.change_name.command', '1', newName));
    }, 50));

    return this._sink(promise);
  }

  processChangeNameAsync(command: Command<string>) {
    return this.processChangeName(command);
  }

  applyChangedNameAsync(event: Event<string>) {
    return this.applyChangedName(event);
  }

  failName(newName: string) {
    return this._sink(new Command('1', 'location.fail_name.command', '1', newName));
  }

  processFailName(command: Command<string>) {
    if (command.payload === 'fail early') {
      throw new Error('Failing early');
    }

    return new Promise<Command<string>>((_resolve, reject) => {
      this._apply(new Event<string>('1', 'location.changed_name.event', command, command.payload), true);
      reject(new Error('uh oh'));
    });

  }

  applyFailedName(_event: Event<string>) {
  }
}

export default Location;
