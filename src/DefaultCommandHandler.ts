import CommandHandler from './CommandHandler';

interface Aggregate {
	[key: string]: any;
}
interface Command {
	type: string
}

export default class DefaultCommandHandler implements CommandHandler {
	handle(aggregate: Aggregate, command: Command) {
		var type = command.type;
		var key = this._extractKey(type);
		var funcName = 'process' + this._capitalize(key);
		var applier = aggregate[funcName];
		if (applier) {
			return applier.bind(aggregate)(command);
		} else {
			throw new Error('Unable to process command: ' + type + ' looking for: ' + funcName);
		}
	};

	// implementation of lodash 3.x _.capitalize
	_capitalize(str: string) {
		return str && (str.charAt(0).toUpperCase() + str.slice(1));
	}

	// imitation of lodash 3.x _.camelCase. Removes underscores and uppercases the next letter
	_camelCase(str: string) {
		return str.replace(/_([a-z])/g, function (g) { return g[1].toUpperCase(); });
	}

	_extractKey(type: string) {
		var parts = type.split('.');
		var filteredParts = [];
		for (var i = 1; i < parts.length - 1; i++) {
			filteredParts.push(parts[i]);
		}
		filteredParts.unshift(filteredParts.pop());
		return this._camelCase(filteredParts.join('_'));
	};
}