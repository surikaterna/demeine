var uuid = require('uuid').v4;
var Promise = require('bluebird');
var defaultFactory = require('./default_factory');
var LOG = require('slf').Logger.getLogger('demeine:repository');
var Repository = function (partition, aggregateType, factory, concurrencyStrategy) {
  this._partition = partition;
  this._factory = factory || defaultFactory(aggregateType);
  this._aggregateType = aggregateType;
  this._concurrencyStrategy = concurrencyStrategy;
};

Repository.prototype.findById = function (id, callback) {
  LOG.info('%s findById(%s)', this.aggregateType, id);
  var self = this;
  var aggregate = this._factory(id);
  var hasSnapshot = this._partition.loadSnapshot !== undefined;
  if (hasSnapshot) {
    return self._partition.loadSnapshot(id).then(function (snapshot) {
      return self._partition.queryStream(id, (snapshot && snapshot.version) || 0).then(function (commits) {
        var events = [];
        commits.forEach(function (commit) {
          events = events.concat(commit.events);
        });
        var version = (snapshot && snapshot.version || 0) + events.length;
        aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
        return aggregate;
      })
    }).nodeify(callback);
  } else {
    return this._partition.openStream(id).then(function (stream) {
      var events = stream.getCommittedEvents();
      var version = stream.getVersion();
      aggregate._rehydrate(events, version);
      return aggregate;
    }).nodeify(callback);
  }
};

Repository.prototype.findEventsById = function (id, callback) {
  LOG.info('%s findEventsById(%s)', this.aggregateType, id);
  return this._partition.openStream(id).then(function (stream) {
    var events = stream.getCommittedEvents();
    return events;
  }).nodeify(callback);
};

Repository.prototype.save = function (aggregate, commitId, callback) {
  var savingWithId = commitId;
  var self = this;
  return this._partition.openStream(aggregate.id).then(function (stream) {
    return aggregate
      .getUncommittedEventsAsync()
      .then(function (events) {
        // check if there is a conflict with event version /sequence
        var isNewStream = stream._version === -1;
        if (!isNewStream && self._concurrencyStrategy) {
          var numberOfEvents = events.length;
          var nextStreamVersion = stream._version + numberOfEvents;
          if (nextStreamVersion > aggregate._version) {
            // if so ask concurrency strategy if still ok or let him throw
            self._concurrencyStrategy(events, stream)
          }
        }
        aggregate.clearUncommittedEvents();
        savingWithId = savingWithId || uuid();
        events.forEach(function (event) {
          LOG.debug('%s append event - %s', self.aggregateType, event.id);
          stream.append(event);
        });
        return stream.commit(savingWithId).then(function () {
          LOG.info('%s committed %d events with %s id', self.aggregateType, events.length, commitId);
          if(self._partition.storeSnapshot !== undefined && aggregate._getSnapshot) {
            LOG.debug('Persisting snapshot for stream %s version %s', aggregate.id, aggregate.getVersion());
            self._partition.storeSnapshot(aggregate.id, aggregate._getSnapshot(), aggregate.getVersion());
          }
          return aggregate;
        }).error(function (e) {
          LOG.debug('Unable to save commmit id: ' + commitId + ' for type: ' + self.aggregateType + ', with ' + events.length + ' events.', e);
          throw e;
        });
      });
  }).nodeify(callback);
};

module.exports = Repository;
