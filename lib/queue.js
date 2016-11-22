var Promise = require('bluebird');
var Queue = function () {
  this._cmdQueue = [];
  this._processing = false;
  this.watingClients = [];
};

Queue.prototype.continueQueue = function () {
  var self = this;
  if (this._cmdQueue.length > 0) {
    this._processing = true;
    var job = this._cmdQueue.shift();
    try {
      // TODO ADD TIMEOUT...
      Promise.resolve(job.fn()).then(function(res) {
        job.resolve(res);
        self.continueQueue();
      }).error(function(e) {
        job.reject(e);
      });
    } catch(e) {
      job.reject(e);
    }
  } else {
    this._processing = false;
    self.notifyWaitingClients();
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

Queue.prototype.notifyWaitingClients = function () {
  var self = this;
  for (var i = 0; i < self.watingClients.length; i++) {
    var client = self.watingClients[i];
    client.resolve();
  }
  self.watingClients = [];
};

Queue.prototype.empty = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.watingClients.push({resolve: resolve, reject: reject})
  })
};

module.exports = Queue;
