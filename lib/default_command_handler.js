var _ = require('lodash');

var DefaultCommandHandler = function() {

}

DefaultCommandHandler.prototype.handle = function(aggregate, command) {
	var type = command.type;
	var key =this._extractKey(type);
	var funcName = 'process' + this._capitalize(key);
    console.log(funcName)
	var applier = aggregate[funcName];
	if(applier) {
		applier.bind(aggregate)(command);
	} else {
		throw new Error('Unable to process command: ' + type + ' looking for: ' +funcName);
	}
};

// implementation of lodash 3.x _.capitalize
DefaultCommandHandler.prototype._capitalize = function(str) {
    return str && (str.charAt(0).toUpperCase() + str.slice(1));
}

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