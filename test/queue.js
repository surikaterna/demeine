var should = require('should');
var Queue = require('../lib/queue');


describe('Queue', function () {
  describe('#queue', function () {
    it('Processes queue in order', function () {
      var queue = new Queue();
      var string = '';
      for (var i = 0; i <= 10; i++) {
        queue.queueCommand(function () {
          string = string + i;
        });
      }
      string.should.eql('012345678910');
    });
    it('should return promise that is resolved upon running complete', function (done) {
      var queue = new Queue();
      var toChange = 12;
      var change = function () {
        toChange = 10;
      };

      queue.queueCommand(change)
        .then(function (res) {
          toChange.should.eql(10);
          done();
        });
    });

  });
});
