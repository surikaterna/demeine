var Promise = require('bluebird');
var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);
//require('debug').enable('*');
var should = require('should');

var Location = require('./aggregates/location');

describe('Aggregate', function () {
  describe('#_apply', function () {
    it('_apply with new event should add to uncommitted collection', function () {
      var loc = new Location();
      loc.registerName('test');
      loc.getUncommittedEventsAsync().then(function (res) {
        res.length.should.equal(1);
      })
    });
  });
  describe('#_sink (with promise)', function () {
    it('_sink with promise should resolve promise before processing', function (done) {
      var loc = new Location();
      loc.registerName('Initial Name');
      loc.changeNameAsync('FIRST-CHANGE');
      loc.registerName('SECOND-CHANGE');
      loc.changeNameAsync('THIRD-CHANGE');

      should.throws(function () {
        // Should throw if trying to get uncommitted events while still processing
        loc.getUncommittedEvents();
      });

      loc.getUncommittedEventsAsync().then(function (res) {
        res[0].payload.should.equal('Initial Name');
        res[1].payload.should.equal('FIRST-CHANGE');
        res[2].payload.should.equal('SECOND-CHANGE');
        res[3].payload.should.equal('THIRD-CHANGE');
        res.length.should.equal(4);
        done();
      })
    });
  });
  describe('#<promise> domain function', function () {
    it('should wait for promise', function (done) {
      var loc = new Location();
      loc.registerName('test').then(function (result) {
        done();
      });
    });
    it('should return promise error when failure in process', function (done) {
      var loc = new Location();
      loc.failName('test')
        .then(function (result) {
          done(new Error('Unreachable'));
        })
        .error(function (e) {
          loc.getUncommittedEventsAsync().then(function (res) {
            res.length.should.equal(0);
            done();
          });
        });
    });
    it('should return promise error when failure in process by throwing', function (done) {
      var loc = new Location();
      loc.failName('fail early')
        .then(function (result) {
          done(new Error('Unreachable'));
        })
        .error(function (e) {
         loc.getUncommittedEventsAsync().then(function (res) {
           res.length.should.equal(0);
            done();
         });
        });
    });
    it('should get error', function (done) {
      var promise = giefPromisePlz();
      promise
        .then(function (res) {
          done(new Error('Unreachable'));
        })
        .error(function (err) {
          done();
        });
    });
  });
});

var giefPromisePlz = function () {
  return new Promise(function (resolve, reject) {
    try {
      var functionThatThrows = function () {
        throw new Error('error is thrown!');
      };
      var test = functionThatThrows();
      resolve(test);
    } catch (error) {
      reject(error);
    }
  }).error(function (error) {
    throw error;
  });
}
