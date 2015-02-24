var _ = require('lodash');

var DefaultCommandHandler = function() {

}

DefaultCommandHandler.prototype.handle = function(aggregate, command) {
	var type = command.type;
	var key = _.camelCase(this._extractKey(type));
	var funcName = 'process' + _.capitalize(key);
	var applier = aggregate[funcName];
	if(applier) {
		applier.bind(aggregate)(command);
	} else {
		throw new Error('Unable to process command' + type);
	}
};

DefaultCommandHandler.prototype._extractKey = function(type) {
	return type.split('.')[1];
};

module.exports = DefaultCommandHandler;