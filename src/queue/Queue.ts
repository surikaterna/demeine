import EventEmitter from 'events';
import PQueue from 'p-queue';

interface QueueOptions {
  concurrency?: number
}

type Task<Result = unknown> = (() => Result) | (() => PromiseLike<Result>);

export class Queue extends EventEmitter {
  private readonly maxConcurrent: number;
  private readonly queue: PQueue;

  constructor(_jobTimeout?: number, options?: QueueOptions) {
    super();

    this.maxConcurrent = options?.concurrency ?? 1;

    this.queue = new PQueue({
      concurrency: this.maxConcurrent
    });

    this.queueCommand = this.queueCommand.bind(this);
    this.queue.on('idle', this.notifyWaitingClients);
  }

  empty = (): Promise<this> => new Promise((resolve) => this.isProcessing()
    ? this.once('empty', () => resolve(this))
    : resolve(this)
  );

  isProcessing = (): boolean => this.queue.pending > 0;

  queueCommand = <Result>(fn: Task<Result>): Promise<Result> => this.queue.add(fn);

  private notifyWaitingClients = (): void => {
    this.emit('empty');
  };
}

export default Queue;
