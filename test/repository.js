// var sdebug = require('slf-debug').default;
// require('slf').LoggerFactory.setFactory(sdebug);
// require('debug').enable('*');

var should = require('should');
var Promise = require('bluebird');

var Repository = require('..').Repository;

var Location = require('./aggregates/location');


describe('Repository', function () {
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
  }


  describe('#findById', function () {

    it('returns aggregate with version = -1 if new stream', function (done) {
      var repo = new Repository(new Partition(), 'test_aggregate');
      repo.findById('ID_THAT_DO_NOT_EXIST').then(function (aggregate) {
        aggregate.getVersion().should.equal(-1);
        done();
      }).catch(function (err) {
        done(err);
      });;
    });

    it('creates aggregates with custom factory', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new Partition(), 'location', factory);
      repo.findById('ID_THAT_DO_NOT_EXIST').then(function (aggregate) {
        if (aggregate instanceof Location) {
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });;
    });


    it('hydrates aggregates with snapshot', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: 1, type: 'location.changed_name.event', payload: 'Hello' }]), 'location', factory);
      repo.findById('1').then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('hello');
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });;
    });
    it('hydrates aggregates without snapshot', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new SnapshotPartition(undefined, [{ id: 1, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' }]), 'location', factory);
      repo.findById('1').then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('Hello');
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });;
    });
    it('stores snapshot for aggregate on save', function (done) {
      var factory = function () { return new Location(); };
      var part = new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: 1, type: 'location.changed_name.event', payload: 'Hello' }]);
      var repo = new Repository(part, 'location', factory);
      repo.findById('1').then(function (aggregate) {
        aggregate.changeName('Hello, World!');
        repo.save(aggregate).then(function () {
          part.loadSnapshot('1').then(function (snapshot) {
            snapshot.snapshot.name.should.equal('Hello, World!');
            done();
          })
        });
      }).catch(function (err) {
        done(err);
      });;
    });
  });
  describe('#save', function () {
    it('save should clear uncommitted events ', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new Partition(), 'location', factory);
      repo.findById('ID_THAT_DO_NOT_EXIST').then(function (location) {
        location.changeName('New Name');
        repo.save(location).then(function (x) {
          x.getUncommittedEvents().length.should.equal(0);
          done();
        });
      }).catch(function (err) {
        done(err);
      });
    });
  });
});
