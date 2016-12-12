var Promise = require('bluebird');
var PromiseQueue = require('./promise_queue');
PromiseQueue.configure(Promise);

var Queue = function (jobTimeout, options) {
  this._maxConcurrent = options && options.concurrency || 1;
  this._maxQueue = Infinity;
  this._queue = new PromiseQueue(this._maxConcurrent, this._maxQueue, { onEmpty: this._queueComplete.bind(this) });
  this.watingClients = [];
};

Queue.prototype._queueComplete = function () {
  this._notifyWaitingClients();
};

Queue.prototype.queueCommand = function (fn) {
  return this._queue.add(fn);
};

Queue.prototype.isProcessing = function () {
  return this._queue.getPendingLength() > 0;
};

Queue.prototype.empty = function () {
  var self = this;
  if (!self.isProcessing()) {
    return Promise.resolve();
  }

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
