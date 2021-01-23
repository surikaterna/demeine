import { Event } from '@surikat/core-domain';
import { Aggregate, ApplyFunc, BaseState } from 'aggregate';

export interface EventHandler {
  handle<State extends BaseState = BaseState, Payload = unknown>(aggregate: Aggregate<State>, event: Event<Payload>): ReturnType<ApplyFunc<State>>;
}

export class DefaultEventHandler implements EventHandler {
  handle = <State extends BaseState = BaseState, Payload = unknown>(aggregate: Aggregate<State>, event: Event<Payload>): ReturnType<ApplyFunc<State>> => {
    const type = event.type;
    const key = this.extractKey(type);
    const funcName = `apply${this.capitalize(key)}` as keyof Aggregate<State>;
    const applier = aggregate[funcName] as ApplyFunc<State>;

    if (applier) {
      return applier.bind(aggregate)(event);
    } else {
      throw new Error(`Unable to apply event ${type} || ${funcName}`);
    }
  };

  private extractKey(type: string): string {
    const parts = type.split('.');
    const filteredParts: string[] = [];

    for (let i = 1; i < parts.length - 1; i++) {
      filteredParts.push(parts[i]);
    }

    return this.camelCase(filteredParts.join('_'));
  }

  private camelCase = (text: string) => text.replace(/_([a-z])/g, (part) => part[1].toUpperCase());

  private capitalize = (text: string) => text && text.charAt(0).toUpperCase() + text.slice(1);
}

export default DefaultEventHandler;
