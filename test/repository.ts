// var sdebug = require('slf-debug').default;
// require('slf').LoggerFactory.setFactory(sdebug);
// require('debug').enable('*');
import Repository from '../src/Repository';
import Event from '../src/Event';
import Location, { LocationState } from './aggregates/Location';
import 'mocha';
import 'should';
import { default as Promise } from 'bluebird';

interface Commit {
  events: Event[];
}
interface Snapshot<T> {
  id?: any
  version: number;
  snapshot: T
}

class MyStream {
  _version: number = 0;
  getCommittedEvents() {
    return [];
  };
  getVersion() {
    return -1;
  }
  append() { };
  commit() { return Promise.resolve(null); };
}
class MyPartition {
  openStream(streamId: string) {
    return Promise.resolve(new MyStream());
  }
  queryStream(id: string): Promise<Commit[]> {
    return Promise.resolve([]);
  }
}

class SnapshotPartition<T> {
  _snapshot: Snapshot<T>;
  _events: Event[];

  constructor(snapshot: Snapshot<T>, events: Event[]) {
    this._snapshot = snapshot;
    this._events = events;
  }
  loadSnapshot(id: string): Promise<Snapshot<T>> {
    return Promise.resolve(this._snapshot);
  }
  openStream(streamId: string) {
    return Promise.resolve(new MyStream());
  }
  storeSnapshot(id: String, snapshot: T, version: number) {
    this._snapshot = { id, snapshot, version };
    return Promise.resolve(this._snapshot);
  }
  queryStream(id: string, fromEventSequence: number = 0, callback?: Function): Promise<Commit[]> {
    var result = [{ events: this._events }];
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


describe('Repository', function () {





  describe('#findById', function () {

    it('returns aggregate with version = -1 if new stream', function (done) {
      var repo = new Repository(new MyPartition(), 'test_aggregate');
      repo.findById('ID_THAT_DO_NOT_EXIST').then(function (aggregate) {
        aggregate.getVersion().should.equal(-1);
        done();
      }).catch(function (err) {
        done(err);
      });;
    });

    it('creates aggregates with custom factory', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new MyPartition(), 'location', factory);
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
      var repo = new Repository(new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' }]), 'location', factory);
      repo.findById('1').then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('hello');
          aggregate.getVersion().should.equal(1);
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });
    });
    it('hydrates aggregates with snapshot and events', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' }, { id: '2', aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello, world' }]), 'location', factory);
      repo.findById('1').then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('Hello, world');
          aggregate.getVersion().should.equal(2);
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });
    });
    it('hydrates aggregates without snapshot', function (done) {
      var factory = function () { return new Location(); };
      var repo = new Repository(new SnapshotPartition<object>({ version: -1, snapshot: {} }, [{ id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' }]), 'location', factory);
      repo.findById('1').then(function (aggregate) {
        if (aggregate instanceof Location) {
          aggregate._getSnapshot().name.should.equal('Hello');
          done();
        } else {
          done('Wrong type created');
        }
      }).catch(function (err) {
        done(err);
      });
    });
    it('stores snapshot for aggregate on save', function (done) {
      var factory = function () { return new Location(); };
      var part = new SnapshotPartition<LocationState>({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{ id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: 'Hello' }]);
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
      var repo = new Repository(new MyPartition(), 'location', factory);
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
