import EventHandler from './EventHandler';
import Event from './Event';

interface Aggregate {
	[key: string]: any;
}


export default class DefaultEventHandler implements EventHandler {
	handle(aggregate: Aggregate, event: Event) {
		const type = event.type;
		const key = this._extractKey(type);
		const funcName = 'apply' + this._capitalize(key);
		const applier = aggregate[funcName];
		if (applier) {
			return applier.bind(aggregate)(event);
		} else {
			throw new Error('Unable to apply event ' + type + " || " + funcName);
		}
	};

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
		return this._camelCase(filteredParts.join('_'));
	};
}
