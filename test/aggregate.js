var Location = require('./aggregates/location');
describe('Aggregate', function () {
  describe('#_apply', function () {
    it('_apply with new event should add to uncommitted collection', function () {
      var loc = new Location();
      loc.changeName('test');
      loc.getUncommittedEvents().length.should.equal(1);
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
    it.only('should return promise error when failure in process by throwing', function (done) {
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
