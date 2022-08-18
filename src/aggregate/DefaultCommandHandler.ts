import { camelCase, capitalize } from '../utils/stringUtils';
import { Aggregate } from './Aggregate';
import { Command, CommandHandler, ProcessFunc } from './Aggregate.interfaces';

export class DefaultCommandHandler<State extends object = object> implements CommandHandler<State> {
  handle(aggregate: Aggregate<State>, command: Command) {
    const type = command.type;
    const key = this._extractKey(type);
    const funcName = `process${capitalize(key)}` as keyof Aggregate<State>;
    const applier = aggregate[funcName] as ProcessFunc<State>;
    if (applier) {
      return applier.bind(aggregate)(command);
    } else {
      throw new Error(`Unable to process command: ${type} looking for: ${funcName}`);
    }
  }

  _extractKey(type: string) {
    const parts = type.split('.');
    const filteredParts = [];
    for (let i = 1; i < parts.length - 1; i++) {
      filteredParts.push(parts[i]);
    }
    filteredParts.unshift(filteredParts.pop());
    return camelCase(filteredParts.join('_'));
  }
}
