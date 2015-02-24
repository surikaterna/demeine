var Aggregate = require('./aggregate');

var DefaultFactory = function(aggregateType) {
	return function() {
		return new Aggregate();
	}		
}

module.exports = DefaultFactory;