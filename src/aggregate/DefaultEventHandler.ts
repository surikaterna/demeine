import { camelCase, capitalize } from '../utils/stringUtils';
import { Aggregate } from './Aggregate';
import { ApplyFunc, Event, EventHandler } from './Aggregate.interfaces';

export class DefaultEventHandler<State extends object = object> implements EventHandler<State> {
  handle(aggregate: Aggregate<State>, event: Event): void {
    const type = event.type;
    const key = this._extractKey(type);
    const funcName = `apply${capitalize(key)}` as keyof Aggregate<State>;
    const applier = aggregate[funcName] as ApplyFunc<State> | undefined;
    if (applier) {
      return applier.bind(aggregate)(event);
    } else {
      throw new Error(`Unable to apply event ${type} || ${funcName}`);
    }
  }

  _extractKey(type: string): string {
    const parts = type.split('.');
    const filteredParts = [];
    for (let i = 1; i < parts.length - 1; i++) {
      filteredParts.push(parts[i]);
    }
    return camelCase(filteredParts.join('_'));
  }
}
