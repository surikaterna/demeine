var Queue = require('../src/Queue').default;

describe('Queue', function () {
  describe('#queue', function () {
    it('Processes queue in order', function (done) {
      var queue = new Queue();
      var string = '';
      var incrementString = function(i) {
        return function() {
          return string +=i ;
        }
      };
      for (var i = 0; i < 10; i++) {
        queue.queueCommand(incrementString(i));
      }
      queue.queueCommand(function () {
        string = string + '10';
      }).then(function (res) {
        expect(string).toEqual('012345678910');
        done();
      }).catch(console.log);
    });
    it('should return promise that is resolved upon running complete', function (done) {
      var queue = new Queue();
      var toChange = 12;
      var change = function () {
        toChange = 10;
      };

      queue.queueCommand(change)
        .then(function (res) {
          expect(toChange).toEqual(10);
          done();
        });
    });
    it('should return promise that is resolved directly when not running', function (done) {
      var queue = new Queue();
      queue.empty().then(function () {
        done();
      })
    });

  });
});
