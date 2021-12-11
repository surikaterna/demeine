var SnapshotPartition = require('./partitions/partitions').SnapshotPartition;
var ConflictPartition = require('./partitions/partitions').ConflictPartition;
var Partition = require('./partitions/partitions').Partition;
var Repository = require('../src').Repository;

var Location = require('./aggregates/location');

describe('Repository', function () {
  describe('#findById', function () {
    it('returns aggregate with version = -1 if new stream', function (done) {
      var repo = new Repository(new Partition(), 'test_aggregate', undefined, undefined, { resetSnapshotOnFail: false });
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (aggregate) {
          expect(aggregate.getVersion()).toBe(-1);
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
            expect(aggregate._getSnapshot().name).toBe('hello');
            expect(aggregate.getVersion()).toBe(1);
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
            expect(aggregate._getSnapshot().name).toBe('Hello, world');
            expect(aggregate.getVersion()).toBe(2);
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
            expect(aggregate._getSnapshot().name).toBe('Hello');
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
              expect(snapshot.snapshot.name).toBe('Hello, World!');
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
            expect(x.getUncommittedEvents()).toHaveLength(0);
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
        expect(nextEvents[0].payload).toBe('New Name');
        expect(committedEvents[0].payload).toBe('New Name committed');
        conflictStrategyCalled = true;
        return true; // throw..
      };
      var repo = new Repository(part, 'location', factory, conflictStrategy);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo.save(location).catch(function () {
            expect(conflictStrategyCalled).toBe(true);
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
        expect(nextEvents[0].payload).toBe('New Name');
        conflictStrategyCalled = true;
        return true; // throw..
      };
      var repo = new Repository(part, 'location', factory, conflictStrategy);
      repo
        .findById('ID_THAT_DO_NOT_EXIST')
        .then(function (location) {
          location.registerName('New Name');
          repo.save(location).catch(function () {
            expect(conflictStrategyCalled).toBe(true);
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
        expect(nextEvents[0].payload).toBe('New Name');
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
              expect(conflictStrategyCalled).toBe(true);
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
          expect(aggregate._getSnapshot().name).toBe('Hello, world');
          expect(aggregate.getVersion()).toBe(2);
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
