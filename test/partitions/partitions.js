var Promise = require('bluebird');

var Partition = function () {
  this.openStream = function (streamId) {
    var Stream = function () {
      this.getCommittedEvents = function () {
        return [];
      };
      this.getVersion = function () {
        return -1;
      }
      this.append = function () { };
      this.commit = function () { return Promise.resolve(null); };
    }
    return Promise.resolve(new Stream(streamId));
  }
  this.delete = function(streamId, event) {
  }
}

var ConflictPartition = function () {
  var mockVersion = 1;
  this.openStream = function (streamId) {
    var Stream = function () {
      ++mockVersion;
      var self = this;
      this._version = mockVersion;
      this.getCommittedEvents = function () {
        return [{
          type: 'location.registered_name.event',
          payload: 'New Name committed',
          aggregateId: 1,
          id: 'c2d08471-2e0a-4c27-8557-64201f51f249'
        }];
      };
      this.getVersion = function () {
        return self._version;
      }
      this.append = function () { };
      this.commit = function () { return Promise.resolve(null); };
    }
    return Promise.resolve(new Stream(streamId));
  }
}

var SnapshotPartition = function (snapshot, events) {
  this._snapshot = snapshot;
  this.loadSnapshot = function () {
    return Promise.resolve(this._snapshot);
  }
  this.openStream = function (streamId) {
    var Stream = function () {
      this.getCommittedEvents = function () {
        return [];
      };
      this.getVersion = function () {
        return -1;
      }
      this.append = function () { };
      this.commit = function () { return Promise.resolve(null); };
    }
    return Promise.resolve(new Stream(streamId));
  }
  this.storeSnapshot = function (id, snapshot, version) {
    this._snapshot = { id: id, snapshot: snapshot, version: version };
    return Promise.resolve(this._snapshot);
  }
  this.removeSnapshot = function (id) {
    this._snapshot = { id: id, version: -1 };
    return Promise.resolve(this._snapshot);
  }
  this.queryStream = function (id, fromEventSequence, callback) {
    var result = [{ events: events }];
    if (fromEventSequence > 0) {
      var startCommitId = 0;
      var foundEvents = 0;
      for (var i = 0; i < result.length; i++) {
        foundEvents += result[0].events.length;
        startCommitId++;
        if (foundEvents >= fromEventSequence) {
          break;
        }
      }
      var tooMany = foundEvents - fromEventSequence;

      result = result.slice(startCommitId - (tooMany > 0 ? 1 : 0));
      if (tooMany > 0) {
        result[0].events = result[0].events.slice(result[0].events.length - tooMany);
      }
    }
    return Promise.resolve(result).nodeify(callback);
  }
};

module.exports.Partition = Partition;
module.exports.SnapshotPartition = SnapshotPartition;
module.exports.ConflictPartition = ConflictPartition;
