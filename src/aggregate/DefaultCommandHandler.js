export class DefaultCommandHandler {
  handle(aggregate, command) {
    const type = command.type;
    const key = this._extractKey(type);
    const funcName = 'process' + this._capitalize(key);
    const applier = aggregate[funcName];
    if (applier) {
      return applier.bind(aggregate)(command);
    } else {
      throw new Error('Unable to process command: ' + type + ' looking for: ' + funcName);
    }
  }

  // implementation of lodash 3.x _.capitalize
  _capitalize(str) {
    return str && (str.charAt(0).toUpperCase() + str.slice(1));
  }

  // imitation of lodash 3.x _.camelCase. Removes underscores and uppercases the next letter
  _camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  _extractKey(type) {
    const parts = type.split('.');
    const filteredParts = [];
    for (let i = 1; i < parts.length - 1; i++) {
      filteredParts.push(parts[i]);
    }
    filteredParts.unshift(filteredParts.pop());
    return this._camelCase(filteredParts.join('_'));
  }
}
