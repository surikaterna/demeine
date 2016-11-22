var Promise = require('bluebird');

var Queue = function (jobTimeout) {
  this._cmdQueue = [];
  this._processing = false;
  this.watingClients = [];
  this._timeout = jobTimeout || 15 * 1000;
};

Queue.prototype.continueQueue = function () {
  var self = this;
  if (this._cmdQueue.length > 0) {
    this._processing = true;
    var job = this._cmdQueue.shift();
    try {
      Promise.resolve(job.fn())
        .timeout(self._timeout) // TODO If timeout exceeded - throw away job and continue queue.
        .then(function(res) {
          job.resolve(res);
          self.continueQueue();
        })
        .catch(Promise.TimeoutError, function(e) {
          job.reject('could complete job within ' + self._timeout + 'ms');
          self.continueQueue();
        })
        .error(function(e) {
          job.reject(e);
          self.continueQueue();
        });
    } catch(e) {
      job.reject(e);
    }
  } else {
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
  return new Promise(function (resolve, reject) {
    self.watingClients.push({resolve: resolve, reject: reject})
  })
};

Queue.prototype._notifyWaitingClients = function () {
  var self = this;
  for (var i = 0; i < self.watingClients.length; i++) {
    var client = self.watingClients[i];
    client.resolve();
  }
  self.watingClients = [];
};

module.exports = Queue;
