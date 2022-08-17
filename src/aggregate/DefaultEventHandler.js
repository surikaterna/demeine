export class DefaultEventHandler {
  handle(aggregate, event) {
    const type = event.type;
    const key = this._extractKey(type);
    const funcName = 'apply' + this._capitalize(key);
    const applier = aggregate[funcName];
    if (applier) {
      return applier.bind(aggregate)(event);
    } else {
      throw new Error('Unable to apply event ' + type + ' || ' + funcName);
    }
  }

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
    return this._camelCase(filteredParts.join('_'));
  }
}
