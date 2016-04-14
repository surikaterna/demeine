var _ = require('lodash');

var DefaultEventHandler = function() {

}

DefaultEventHandler.prototype.handle = function(aggregate, event) {
	var type = event.type;
	var key = this._extractKey(type);
	var applier = aggregate[funcName];
	if(applier) {
		applier.bind(aggregate)(event);
	} else {
		console.log(aggregate);
		console.log('Unable to apply event ' + type + " || " + funcName);
		throw new Error('Unable to apply event ' + type + " || " + funcName);
	}
};

DefaultEventHandler.prototype._capitalize = function(str) {
    return str && (str.charAt(0).toUpperCase() + str.slice(1));
}

DefaultEventHandler.prototype._extractKey = function(type) {
	var parts = type.split('.');
	var filteredParts = [];
	for(var i=1; i<parts.length-1; i++) {
		filteredParts.push(parts[i]);
	}
	return _.camelCase(filteredParts.join('_'));
};

module.exports = DefaultEventHandler;
