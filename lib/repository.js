var uuid = require('node-uuid').v4;
var Promise = require('bluebird');
var defaultFactory = require('./default_factory');

var Repository = function(partition, aggregateType, factory) {
	this._partition = partition;
	this._factory = factory || defaultFactory(aggregateType);
	this._aggregateType = aggregateType
};

Repository.prototype.findById = function(id, callback) {
	var aggregate = this._factory(id);
	return this._partition.openStream(id).then(function(stream) {
		var events = stream.getCommittedEvents();
		var version = stream.getVersion();
		aggregate._rehydrate(events, version);
		return aggregate;
	}).nodeify(callback);

};

Repository.prototype.save = function(aggregate, commitId, callback) {
	return this._partition.openStream(aggregate.id).then(function(stream) {
		var events=aggregate.getUncommittedEvents();
		aggregate.clearUncommittedEvents();

		var commitId = commitId || uuid();
		events.forEach(function(event) {
			stream.append(event);
		});
		stream.commit(commitId);
		return aggregate;	
	}).nodeify(callback);
};

module.exports = Repository;
