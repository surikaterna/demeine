var DefaultEventHandler = function() {

}

DefaultEventHandler.prototype.handle = function(aggregate, event) {
	var type = event.type;
	var key = this._extractKey(type);
	var funcName = 'apply' + this._capitalize(key);
	var applier = aggregate[funcName];
	if(applier) {
		return applier.bind(aggregate)(event);
	} else {
		console.log(aggregate);
		console.log('Unable to apply event ' + type + " || " + funcName);
		throw new Error('Unable to apply event ' + type + " || " + funcName);
	}
};

DefaultEventHandler.prototype._capitalize = function(str) {
    return str && (str.charAt(0).toUpperCase() + str.slice(1));
}

// imitation of lodash 3.x _.camelCase. Removes underscores and uppercases the next letter
DefaultEventHandler.prototype._camelCase = function(str) {
    return str.replace(/_([a-z])/g, function (g) { return g[1].toUpperCase(); });
}

DefaultEventHandler.prototype._extractKey = function(type) {
	var parts = type.split('.');
	var filteredParts = [];
	for(var i=1; i<parts.length-1; i++) {
		filteredParts.push(parts[i]);
	}
	return this._camelCase(filteredParts.join('_'));
};

module.exports = DefaultEventHandler;
