var uuid = require('uuid').v4;
var Promise = require('bluebird');
var defaultFactory = require('./default_factory');
var LOG = require('slf').Logger.getLogger('demeine:repository');

var Repository = function (partition, aggregateType, factory, concurrencyStrategy, options) {
  this._partition = partition;
  this._factory = factory || defaultFactory(aggregateType);
  this._aggregateType = aggregateType;
  this._concurrencyStrategy = concurrencyStrategy;
  var opts = options || {};
  this._resetSnapshotOnFail = ('resetSnapshotOnFail' in opts) ? options.resetSnapshotOnFail : true;
};

Repository.prototype.findById = function (id, callback) {
  LOG.info('%s findById(%s)', this.aggregateType, id);
  var self = this;
  if (this._partition.queryStreamWithSnapshot !== undefined) {
    return self.findByQueryStreamWithSnapshot(id, false, callback);
  } else if (this._partition.loadSnapshot !== undefined) {
    return self.findBySnapshot(id, false, callback);
  } else {
    var aggregate = this._factory(id);
    return this._partition.openStream(id).then(function (stream) {
      var events = stream.getCommittedEvents();
      var version = stream.getVersion();
      aggregate._rehydrate(events, version);
      return aggregate;
    }).nodeify(callback);
  }
};

Repository.prototype.findBySnapshot = function (id, isRetry, callback) {
  LOG.info('%s findBySnapshot(%s)', this.aggregateType, id);
  var self = this;
  var aggregate = this._factory(id);
  return self._partition.loadSnapshot(id).then(function (snapshot) {
    return self._partition.queryStream(id, (snapshot && snapshot.version) || 0).then(function (commits) {
      var events = [];
      commits.forEach(function (commit) {
        events = events.concat(commit.events);
      });
      var version = (snapshot && snapshot.version || 0) + events.length;
      try {
        aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
      } catch (e) {
        if (self._partition.removeSnapshot && self._resetSnapshotOnFail && !isRetry) { // check if this is a retry to prevent infinite loop
          // delete snapshot and retry...
          return self._partition.removeSnapshot(id).then(function() {
            return self.findBySnapshot(id, true, callback);
          })
        } else {
          throw e;
        }
      }
      return aggregate;
    })
  }).nodeify(callback);
};

Repository.prototype.findByQueryStreamWithSnapshot = function (id, isRetry, callback) {
  LOG.info('%s findByQueryStreamWithSnapshot(%s)', this.aggregateType, id);
  var self = this;
  var aggregate = this._factory(id);
  return self._partition.queryStreamWithSnapshot(id).then(function (response) {
    var commits = response.commits;
    var snapshot = response.snapshot;
    var events = [];
    if (commits) {
      commits.forEach(function (commit) {
        events = events.concat(commit.events);
      });
    }
    var version = (snapshot && snapshot.version || 0) + events.length;
    try {
      aggregate._rehydrate(events, version, snapshot && snapshot.snapshot);
    } catch (e) {
      if (self._partition.removeSnapshot && self._resetSnapshotOnFail && !isRetry) { // check if this is a retry to prevent infinite loop
        // delete snapshot and retry...
        return self._partition.removeSnapshot(id).then(function() {
          return self.findByQueryStreamWithSnapshot(id, true, callback);
      })
      } else {
        throw e;
      }
    }
    return aggregate;
  }).nodeify(callback);
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
            // if so ask concurrency strategy if still ok or if it needs to throw
            var shouldThrow = self._concurrencyStrategy(events, stream.getCommittedEvents());
            if (shouldThrow === true) {
              throw new Error("Concurrency error. Version mismatch on stream")
            }
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
          if (self._partition.storeSnapshot !== undefined && aggregate._getSnapshot) {
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
