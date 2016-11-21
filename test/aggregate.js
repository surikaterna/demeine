var Promise = require('bluebird');
var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);
require('debug').enable('*');
var should = require('should');

var Location = require('./aggregates/location');

describe('Aggregate', function () {
  describe('#_apply', function () {
    it.only('_apply with new event should add to uncommitted collection', function () {
      var i =0;
      var obj = {i: 2};
      // Promise.resolve(new Promise(function(res, rej) {
      //   console.log('>', i);
      //   i++;
      //   i++;
      //   console.log('>', i);
      // }));
/*      Promise.resolve(obj).then(function(res) {
        i = res.i;
        console.log('>>>>>>>>>> RES: i = ', res.i);
        console.log('>>>>>>>>>>', i);
      });
      console.log('sdjkf', i);
      i.should.equal(2);
*/
      var loc = new Location();
      console.log('!!!!!')
      loc.changeName('test');
      console.log('######');
      loc.getUncommittedEvents().length.should.equal(1);
    });
  });
  describe('#_sink (with promise)', function () {
    it('_sink with promise should resolve promise before processing', function (done) {
      var loc = new Location();
      loc.changeNameAsync('FIRST-CHANGE');
      loc.changeName('SECOND-CHANGE').then(function (res) {
        loc.getUncommittedEvents().length.should.equal(2);
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
