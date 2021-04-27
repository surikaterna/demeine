// var sdebug = require('slf-debug').default;
// require('slf').LoggerFactory.setFactory(sdebug);
// require('debug').enable('*');
var should = require('should');
var SnapshotPartition = require('./partitions/partitions').SnapshotPartition;
var ConflictPartition = require('./partitions/partitions').ConflictPartition;
var Partition = require('./partitions/partitions').Partition;
var Repository = require('..').Repository;

var Location = require('./aggregates/location');

describe('Repository', function () {
  describe('#findById', function () {
    it('returns aggregate with version = -1 if new stream', function (done) {
      var repo = new Repository(new Partition(), 'test_aggregate', undefined, undefined, { resetSnapshotOnFail: false });
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (aggregate) {
          aggregate.getVersion().should.equal(-1);
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('creates aggregates with custom factory', function (done) {
      var factory = function () {
        return new Location();
      };
      var repo = new Repository(new Partition(), 'location', factory);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (aggregate) {
          if (aggregate instanceof Location) {
            done();
          } else {
            done('Wrong type created');
          }
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('hydrates aggregates with snapshot', function (done) {
      var factory = function () {
        return new Location();
      };
      var repo = new Repository(
        new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: 1, type: 'location.registered_name.event', payload: 'Hello' }]),
        'location',
        factory
      );
      repo
        .findById('1')
        .then(function (aggregate) {
          if (aggregate instanceof Location) {
            aggregate._getSnapshot().name.should.equal('hello');
            aggregate.getVersion().should.equal(1);
            done();
          } else {
            done('Wrong type created');
          }
        })
        .catch(function (err) {
          done(err);
        });
    });
    it('hydrates aggregates with snapshot and events', function (done) {
      var factory = function () {
        return new Location();
      };
      var repo = new Repository(
        new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [
          { id: 1, aggregateId: '1', type: 'location.registered_name.event', payload: 'Hello' },
          { id: 2, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello, world' }
        ]),
        'location',
        factory
      );
      repo
        .findById('1')
        .then(function (aggregate) {
          if (aggregate instanceof Location) {
            aggregate._getSnapshot().name.should.equal('Hello, world');
            aggregate.getVersion().should.equal(2);
            done();
          } else {
            done('Wrong type created');
          }
        })
        .catch(function (err) {
          done(err);
        });
    });
    it('hydrates aggregates without snapshot', function (done) {
      var factory = function () {
        return new Location();
      };
      var repo = new Repository(
        new SnapshotPartition(undefined, [{ id: 1, aggregateId: '1', type: 'location.registered_name.event', payload: 'Hello' }]),
        'location',
        factory
      );
      repo
        .findById('1')
        .then(function (aggregate) {
          if (aggregate instanceof Location) {
            aggregate._getSnapshot().name.should.equal('Hello');
            done();
          } else {
            done('Wrong type created');
          }
        })
        .catch(function (err) {
          done(err);
        });
    });
    it('stores snapshot for aggregate on save', function (done) {
      var factory = function () {
        return new Location();
      };
      var part = new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [
        { id: 1, type: 'location.registered_name.event', payload: 'Hello' }
      ]);
      var repo = new Repository(part, 'location', factory);
      repo
        .findById('1')
        .then(function (aggregate) {
          aggregate.changeName('Hello, World!');
          repo.save(aggregate).then(function () {
            part.loadSnapshot('1').then(function (snapshot) {
              snapshot.snapshot.name.should.equal('Hello, World!');
              done();
            });
          });
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
  it('should allow delete', function (done) {
    var factory = function () {
      return new Location();
    };
    var repo = new Repository(new Partition(), 'location', factory);
    repo
      .findById('ID_THAT_DO_NOT_EXIST')
      .then(function (location) {
        location.registerName('New Name');
        repo
          .save(location)
          .then(function (x) {
            location.delete();
            return repo.save(location);
          })
          .then(function () {});
      })
      .catch(function (err) {
        done(err);
      });
  });
  describe('#save', function () {
    it('save should clear uncommitted events ', function (done) {
      var factory = function () {
        return new Location();
      };
      var repo = new Repository(new Partition(), 'location', factory);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo.save(location).then(function (x) {
            x.getUncommittedEvents().length.should.equal(0);
            done();
          });
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
  describe('conflict strategy', function () {
    it('should throw in conflictStrategy with committedEvents', function (done) {
      var factory = function () {
        return new Location();
      };
      var conflictStrategyCalled = false;
      var part = new ConflictPartition(1);
      const conflictStrategy = function (nextEvents, committedEvents) {
        nextEvents[0].payload.should.eql('New Name');
        committedEvents[0].payload.should.eql('New Name committed');
        conflictStrategyCalled = true;
        return true; // throw..
      };
      var repo = new Repository(part, 'location', factory, conflictStrategy);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo.save(location).catch(function () {
            conflictStrategyCalled.should.eql(true);
            done();
          });
        })
        .catch(function (err) {
          done(err);
        });
    });
    it('should throw in conflictStrategy without committedEvents', function (done) {
      var factory = function () {
        return new Location();
      };
      var conflictStrategyCalled = false;
      var part = new ConflictPartition(1);
      const conflictStrategy = function (nextEvents) {
        nextEvents[0].payload.should.eql('New Name');
        conflictStrategyCalled = true;
        return true; // throw..
      };
      var repo = new Repository(part, 'location', factory, conflictStrategy);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo.save(location).catch(function () {
            conflictStrategyCalled.should.eql(true);
            done();
          });
        })
        .catch(function (err) {
          done(err);
        });
    });
    it('should not throw in conflictStrategy', function (done) {
      var factory = function () {
        return new Location();
      };
      var conflictStrategyCalled = false;
      var part = new ConflictPartition(1);
      const conflictStrategy = function (nextEvents) {
        nextEvents[0].payload.should.eql('New Name');
        conflictStrategyCalled = true;
        return false; // do not throw..
      };
      var repo = new Repository(part, 'location', factory, conflictStrategy);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo
            .save(location)
            .then(function () {
              done();
            })
            .catch(function (e) {
              conflictStrategyCalled.should.eql(true);
              done(e);
            });
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
  it('removes and retries snapshot but does not end up in loop if not working', function (done) {
    var factory = function () {
      return new Location();
    };
    var repo = new Repository(
      new SnapshotPartition({ id: '1', version: 1, snapshot: { no_name: 'hello' } }, [
        { id: 1, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' },
        { id: 2, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello, world' }
      ]),
      'location',
      factory
    );
    repo
      .findById('1')
      .then(function () {
        done(new Error('should not fulfill'));
      })
      .catch(function () {
        done();
      });
  });
  it('removes and retries snapshot create when snapshot is broken', function (done) {
    var factory = function () {
      return new Location();
    };
    var repo = new Repository(
      new SnapshotPartition({ id: '1', version: 1, snapshot: { no_name: 'hello' } }, [
        { id: 1, aggregateId: '1', type: 'location.registered_name.event', payload: 'Hello' },
        { id: 1, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' },
        { id: 2, aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello, world' }
      ]),
      'location',
      factory
    );
    repo
      .findById('1')
      .then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('Hello, world');
          aggregate.getVersion().should.equal(2);
          done();
        } else {
          done('Wrong type created');
        }
      })
      .catch(function (err) {
        done(err);
      });
  });
});
