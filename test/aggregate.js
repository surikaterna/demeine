var Promise = require('bluebird');
var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);
require('debug').enable('*');
var should = require('should');

var Location = require('./aggregates/location');

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
      loc.changeNameAsync('FIRST-CHANGE').then(function (res) {
        loc.getUncommittedEventsAsync().then(function (res) {
          res.length.should.equal(3);
        })
      });
      loc.changeName('SECOND-CHANGE').then(function (res) {
        loc.getUncommittedEventsAsync().then(function (res) {
          res.length.should.equal(3);
        })
      });
      loc.changeNameAsync('THIRD-CHANGE').then(function (res) {
        res.getUncommittedEventsAsync().then(function (res) {
          res[0].payload.should.equal('FIRST-CHANGE');
          res[1].payload.should.equal('SECOND-CHANGE');
          res[2].payload.should.equal('THIRD-CHANGE');
        })
      });
      loc.getUncommittedEventsAsync().then(function (res) {
        res.length.should.equal(3);
        done();
      })
    });
  });
  describe('#<promise> domain function', function () {
    it('should wait for promise', function (done) {
      var loc = new Location();
      loc.changeName('test').then(function (result) {
        console.log(result);
        done();
      });
    });
    it('should return promise error when failure in process', function (done) {
      var loc = new Location();
      loc.failName('test').then(function (result) {
        done(new Error('Unreachable'));
      }).error(function (e) {
        loc.getUncommittedEvents().length.should.equal(0);
        done();
      });
    });
    it('should return promise error when failure in process by throwing', function (done) {
      var loc = new Location();
      loc.failName('fail early').then(function (result) {
        console.log('fail 2');
        done(new Error('Unreachable'));
      }).error(function (e) {
        loc.getUncommittedEvents().length.should.equal(0);
        done();
      });
    });
  });
});
