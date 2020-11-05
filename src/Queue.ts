import { EventEmitter } from 'events';
// import Promise from 'bluebird';
import PromiseQueue from './PromiseQueue';
PromiseQueue.configure(Promise);

interface QueueOptions {
  concurrency: number;
}

export default class Queue extends EventEmitter {
  _maxConcurrent: number;
  _maxQueue: number = Infinity;
  _queue: PromiseQueue;
  // @ts-ignore
  constructor(jobTimeout?: number, options: QueueOptions = { concurrency: 1 }) {
    super();
    this._maxConcurrent = options.concurrency;
    this._queue = new PromiseQueue(this._maxConcurrent, this._maxQueue, {
      onEmpty: this._queueComplete.bind(this),
    });
  }

  _queueComplete() {
    this._notifyWaitingClients();
  }

  queueCommand(fn: Function) {
    return this._queue.add(fn);
  }

  isProcessing() {
    return this._queue.getPendingLength() > 0;
  }

  empty() {
    return new Promise<Queue>(resolve => {
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
