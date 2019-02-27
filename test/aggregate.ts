import * as should from 'should'
import Location from './aggregates/Location';
// require('should')
// var Promise = require('bluebird');

var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);
//require('debug').enable('*');



describe('Aggregate', function () {
  describe('#_apply', function () {
    it('_apply with new event should add to uncommitted collection', function () {
      var loc = new Location();
      loc.changeName('test');
      loc.getUncommittedEventsAsync().then(function (res) {
        res.length.should.equal(1);
      })
    });
  });
  describe('#_sink (with promise)', function () {
    it('_sink with promise should resolve promise before processing', function (done) {
      var loc = new Location();
      loc.changeNameAsync('FIRST-CHANGE');
      loc.changeName('SECOND-CHANGE');
      loc.changeNameAsync('THIRD-CHANGE');

      should.throws(function () {
        // Should throw if trying to get uncommitted events while still processing
        loc.getUncommittedEvents();
      });

      loc.getUncommittedEventsAsync().then(function (res) {
        res[0].payload.should.equal('FIRST-CHANGE');
        res[1].payload.should.equal('SECOND-CHANGE');
        res[2].payload.should.equal('THIRD-CHANGE');
        res.length.should.equal(3);
        done();
      })
    });
  });
  describe('#<promise> domain function', function () {
    it('should wait for promise', function (done) {
      var loc = new Location();
      loc.changeName('test').then(function (result) {
        done();
      });
    });
    it('should return promise error when failure in process', function (done) {
      var loc = new Location();
      loc.failName('test')
        .then(function () {
          done(new Error('Unreachable'));
        })
        .catch(function () {
          loc.getUncommittedEventsAsync().then(function (res) {
            res.length.should.equal(0);
            done();
          });
        });
    });
    it('should return promise error when failure in process by throwing', function (done) {
      var loc = new Location();
      loc.failName('fail early')
        .then(function () {
          done(new Error('Unreachable'));
        })
        .catch(function () {
          loc.getUncommittedEventsAsync().then(function (res) {
            res.length.should.equal(0);
            done();
          });
        });
    });
    it('should get error', function (done) {
      var promise = giefPromisePlz();
      promise
        .then(function () {
          done(new Error('Unreachable'));
        })
        .catch(function () {
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
  }).catch(function (error) {
    throw error;
  });
}
