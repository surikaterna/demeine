import EventEmitter from 'events';
import Promise from 'bluebird';
import PromiseQueue from './PromiseQueue';

PromiseQueue.configure(Promise);

export class Queue extends EventEmitter {
  constructor(jobTimeout, options) {
    super();
    this._maxConcurrent = options && options.concurrency || 1;
    this._maxQueue = Infinity;
    this._queue = new PromiseQueue(this._maxConcurrent, this._maxQueue, { onEmpty: this._queueComplete.bind(this) });
  }

  _queueComplete() {
    this._notifyWaitingClients();
  }

  queueCommand(fn) {
    return this._queue.add(fn);
  }

  isProcessing() {
    return this._queue.getPendingLength() > 0;
  }

  empty() {
    return new Promise((resolve, reject) => {
      if (!this.isProcessing()) {
        resolve(this);
      } else {
        this.once('empty', () => {
          resolve(this);
        });
      }
    });
  }

  _notifyWaitingClients() {
    this.emit('empty');
  }
}
