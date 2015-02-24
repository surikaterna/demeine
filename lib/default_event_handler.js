var _ = require('lodash');

var DefaultEventHandler = function() {

}

DefaultEventHandler.prototype.handle = function(aggregate, event) {
	var type = event.type;
	var key = _.camelCase(this._extractKey(type));
	var funcName = 'apply' + _.capitalize(key);
	var applier = aggregate[funcName];
	if(applier) {
		applier.bind(aggregate)(event);
	} else {
		throw new Error('Unable to apply event ' + type);
	}
};

DefaultEventHandler.prototype._extractKey = function(type) {
	return type.split('.')[1];
};

module.exports = DefaultEventHandler;