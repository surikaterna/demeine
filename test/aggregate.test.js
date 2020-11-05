var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);

var Location = require('./aggregates/Location').default;

describe('Aggregate', function() {
  describe('#_apply', function() {
    it('_apply with new event should add to uncommitted collection', function() {
      var loc = new Location();
      loc.registerName('test');
      loc.getUncommittedEventsAsync().then(function(res) {
        expect(res.length).toEqual(1);
      });
    });
  });

  describe('#_sink (with promise)', function() {
    it('_sink with promise should resolve promise before processing', function(done) {
      var loc = new Location();
      loc.registerName('Initial Name');
      loc.changeNameAsync('FIRST-CHANGE');
      loc.registerName('SECOND-CHANGE');
      loc.changeNameAsync('THIRD-CHANGE');

      expect(function() {
        // Should throw if trying to get uncommitted events while still processing
        loc.getUncommittedEvents();
      }).toThrow();

      loc.getUncommittedEventsAsync().then(function(res) {
        expect(res[0].payload).toEqual('Initial Name');
        expect(res[1].payload).toEqual('FIRST-CHANGE');
        expect(res[2].payload).toEqual('SECOND-CHANGE');
        expect(res[3].payload).toEqual('THIRD-CHANGE');
        expect(res.length).toEqual(4);
        done();
      });
    });
  });
  describe('#<promise> domain function', function() {
    it('should wait for promise', function(done) {
      var loc = new Location();
      loc.registerName('test').then(function(result) {
        done();
      });
    });
    it('should return promise error when failure in process', function(done) {
      var loc = new Location();
      loc
        .failName('test')
        .then(function(result) {
          done(new Error('Unreachable'));
        })
        .catch(function(e) {
          loc.getUncommittedEventsAsync().then(function(res) {
            expect(res.length).toEqual(0);
            done();
          });
        });
    });
    it('should return promise error when failure in process by throwing', function(done) {
      var loc = new Location();
      loc
        .failName('fail early')
        .then(function(result) {
          done(new Error('Unreachable'));
        })
        .catch(function(e) {
          loc.getUncommittedEventsAsync().then(function(res) {
            expect(res.length).toEqual(0);
            done();
          });
        });
    });
    it('should get error', function(done) {
      var promise = giefPromisePlz();
      promise
        .then(function(res) {
          done(new Error('Unreachable'));
        })
        .catch(function(err) {
          done();
        });
    });
  });
});

var giefPromisePlz = function() {
  return new Promise(function(resolve, reject) {
    try {
      var functionThatThrows = function() {
        throw new Error('error is thrown!');
      };
      var test = functionThatThrows();
      resolve(test);
    } catch (error) {
      reject(error);
    }
  }).catch(function(error) {
    throw error;
  });
};
