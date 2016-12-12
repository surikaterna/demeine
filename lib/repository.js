var uuid = require('node-uuid').v4;
var Promise = require('bluebird');
var defaultFactory = require('./default_factory');
var LOG = require('slf').Logger.getLogger('demeine:repository');
var Repository = function (partition, aggregateType, factory) {
  this._partition = partition;
  this._factory = factory || defaultFactory(aggregateType);
  this._aggregateType = aggregateType
};

Repository.prototype.findById = function (id, callback) {
  LOG.info('%s findById(%s)', this.aggregateType, id);
  var aggregate = this._factory(id);
  return this._partition.openStream(id).then(function (stream) {
    var events = stream.getCommittedEvents();
    var version = stream.getVersion();
    aggregate._rehydrate(events, version);
    return aggregate;
  }).nodeify(callback);

};

Repository.prototype.save = function (aggregate, commitId, callback) {
  var savingWithId = commitId
  var self = this;
  return this._partition.openStream(aggregate.id).then(function (stream) {
    aggregate
      .getUncommittedEventsAsync()
      .then(function (events) {
        aggregate.clearUncommittedEvents();
        savingWithId = savingWithId || uuid();
        events.forEach(function (event) {
          LOG.debug('%s append event - %s', self.aggregateType, event.id);
          stream.append(event);
        });
        return stream.commit(savingWithId).then(function () {
          LOG.info('%s committed %d events with %s id', self.aggregateType, events.length, commitId);
          return aggregate;
        }).error(function (e) {
          LOG.error('%s unable to commit %d events with %s id', self.aggregateType, events.length, commitId, e);
          throw e;
        });
      });
  }).nodeify(callback);
};

module.exports = Repository;
