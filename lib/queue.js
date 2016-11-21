
var Queue = function () {
  this._cmdQueue = [];
  this._processing = false;
};

Queue.prototype.continueQueue = function () {
  if (this._cmdQueue.length > 0) {
    this._processing = true;
    var job = this._cmdQueue.pop();
    try {
      var result = job.fn();
      console.log('resolve');
      job.resolve(result);
    } catch(e) {
      console.log('reject');
      job.reject(e);
    }
    console.log('continue queue');
    this.continueQueue();
  } else {
    this._processing = false;
  }
};

Queue.prototype.queueCommand = function (fn) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._cmdQueue.push({ fn: fn, resolve: resolve, reject: reject });
    if(!self._processing) {
      self.continueQueue();
    }
  });
};

module.exports = Queue;
