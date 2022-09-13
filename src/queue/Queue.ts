import EventEmitter from 'events';
import PQueue from 'p-queue';

type Task<TaskResultType> = (() => PromiseLike<TaskResultType>) | (() => TaskResultType);

export interface QueueOptions {
  concurrency?: number;
}

export class Queue extends EventEmitter {
  _queue: PQueue;

  constructor(options?: QueueOptions) {
    super();

    this._queue = new PQueue({
      concurrency: options?.concurrency || 1
    });
  }

  queueCommand<Result = unknown>(fn: Task<Result>): Promise<Result> {
    return this._queue.add(fn);
  }

  isProcessing(): boolean {
    return this._queue.size > 0;
  }

  empty(): Promise<void> {
    return this._queue.onIdle();
  }
}
