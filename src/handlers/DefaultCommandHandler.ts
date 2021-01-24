import { Command } from '@surikat/core-domain';
import { Aggregate, BaseState, ProcessFunc } from '../aggregate';

export interface CommandHandler {
  handle<State extends BaseState = BaseState, Payload = unknown>(aggregate: Aggregate<State>, command: Command<Payload>): ReturnType<ProcessFunc<State>>;
}

export class DefaultCommandHandler implements CommandHandler {
  handle = <State extends BaseState = BaseState, Payload = unknown>(aggregate: Aggregate<State>, command: Command<Payload>): ReturnType<ProcessFunc<State>> => {
    const type = command.type;
    const key = this.extractKey(type);
    const funcName = `process${this.capitalize(key)}` as keyof Aggregate<State>;
    const applier = aggregate[funcName] as ProcessFunc<State>;

    if (applier) {
      return applier.bind(aggregate)(command);
    } else {
      throw new Error(`Unable to process command: ${type} looking for: ${funcName}`);
    }
  };

  private extractKey = (type: string): string => {
    const parts = type.split('.');
    const filteredParts: string[] = [];

    for (let i = 1; i < parts.length - 1; i++) {
      filteredParts.push(parts[i]);
    }

    const firstPart = filteredParts.pop();

    if (!firstPart) {
      throw new Error('Does does not satisfy restriction. Cannot extract key.');
    }

    filteredParts.unshift(firstPart);
    return this.camelCase(filteredParts.join('_'));
  };

  private camelCase = (text: string) => text.replace(/_([a-z])/g, (part) => part[1].toUpperCase());

  private capitalize = (text: string) => text && text.charAt(0).toUpperCase() + text.slice(1);
}

export default DefaultCommandHandler;
