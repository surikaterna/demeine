var _ = require('lodash');

var DefaultCommandHandler = function() {

}

DefaultCommandHandler.prototype.handle = function(aggregate, command) {
	var type = command.type;
	var key =this._extractKey(type);
	var funcName = 'process' + _.capitalize(key);
	var applier = aggregate[funcName];
	if(applier) {
		applier.bind(aggregate)(command);
	} else {
		throw new Error('Unable to process command: ' + type + ' looking for: ' +funcName);
	}
};

DefaultCommandHandler.prototype._extractKey = function(type) {
	var parts = type.split('.');
	var filteredParts = [];
	for(var i=1; i<parts.length-1; i++) {
		filteredParts.push(parts[i]);
	}
	filteredParts.unshift(filteredParts.pop());
	return _.camelCase(filteredParts.join('_'));
};

module.exports = DefaultCommandHandler;