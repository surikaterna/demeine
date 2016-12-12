var Promise = require('bluebird');

var Queue = function (jobTimeout) {
  this._cmdQueue = [];
  this._processing = false;
  this.watingClients = [];
  this._timeout = jobTimeout || 15 * 1000;
};

Queue.prototype.continueQueue = function () {
  console.log('queue..');
  var self = this;
  if (this._cmdQueue.length > 0) {
    this._processing = true;
    var job = this._cmdQueue.shift();
    try {
      var result = job.fn();
      job.resolve(result);
/*      Promise.resolve(job.fn())
        .timeout(self._timeout) // TODO If timeout exceeded - throw away job and continue queue.
        .then(function(res) {
          console.log('res', res);
          job.resolve(res);
          self.continueQueue();
        })
        .catch(Promise.TimeoutError, function() {
          job.reject('could complete job within ' + self._timeout + 'ms');
          self.continueQueue();
        })
        .error(function(e) {
          console.log('ERR22');
          //job.reject(e);
          self.continueQueue();
          throw e;
        });
        */
    } catch(e) {
      console.log('ERR33', e);
      job.reject(e);
      self.continueQueue();
    } finally {
      console.log('continue queue');
      self.continueQueue();
      console.log('finally..', this._cmdQueue.length);
    }
  } else {
    console.log('finished');
    this._processing = false;
    self._notifyWaitingClients();
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

Queue.prototype.isProcessing = function () {
  return this._processing;
};

Queue.prototype.empty = function () {
  var self = this;
  if (!self.isProcessing()) {
    console.log('not processing');
    return new Promise((resolve, reject) => resolve());
  }
  return new Promise(function (resolve, reject) {
    self.watingClients.push({resolve: resolve, reject: reject})
  })
};

Queue.prototype._notifyWaitingClients = function () {
  var self = this;
  console.log('clients', self.watingClients);
  for (var i = 0; i < self.watingClients.length; i++) {
    var client = self.watingClients[i];
    client.resolve();
  }
  self.watingClients = [];
};

module.exports = Queue;
