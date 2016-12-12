var EventEmitter = require('events');
var util=require('util');

var Promise = require('bluebird');
var PromiseQueue = require('./promise_queue');
PromiseQueue.configure(Promise);

var Queue = function (jobTimeout, options) {
  EventEmitter.call(this);
  this._maxConcurrent = options && options.concurrency || 1;
  this._maxQueue = Infinity;
  this._queue = new PromiseQueue(this._maxConcurrent, this._maxQueue, { onEmpty: this._queueComplete.bind(this) });
};

util.inherits(Queue, EventEmitter);

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
  return new Promise(function (resolve, reject) {
    if (!self.isProcessing()) {
      resolve(self);
    } else {
      self.once('empty', function () {
        resolve(self);
      })
    }
  })
};

Queue.prototype._notifyWaitingClients = function () {
  this.emit('empty');
};

module.exports = Queue;
