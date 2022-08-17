import EventEmitter from 'events';
import PQueue from 'p-queue';

export class Queue extends EventEmitter {
  constructor(options) {
    super();
    this._queue = new PQueue({
      concurrency: options?.concurrency || 1
    });
  }

  queueCommand(fn) {
    return this._queue.add(fn);
  }

  isProcessing() {
    return this._queue.size > 0;
  }

  empty() {
    return this._queue.onIdle();
  }
}
