/*
*  Copied from branch https://github.com/adjohnson916/promise-queue/blob/on-empty/lib/index.js
*  in order to get onEmpty functionality.
*
* AK: Changed to TypeScript 2019-02-26
*/

/**

let LocalPromise = typeof Promise !== 'undefined' ? Promise : function () {
  return {
    then: function () {
      throw new Error('Queue.configure() before use Queue');
    }
  };
};

var noop() { };
*/

interface QueueOptions {
  onEmpty?: Function;
}

interface QueueItem {
  promiseGenerator: Function;
  resolve: Function;
  reject: Function;
}

/**
 * It limits concurrently executed promises
 *
 * @param {Number} [maxPendingPromises=Infinity] max number of concurrently executed promises
 * @param {Number} [maxQueuedPromises=Infinity]  max number of queued promises
 * @constructor
 *
 * @example
 *
 * var queue = new Queue(1);
 *
 * queue.add(function () {
   *     // resolve of this promise will resume next request
   *     return downloadTarballFromGithub(url, file);
   * })
 * .then(function (file) {
   *     doStuffWith(file);
   * });
 *
 * queue.add(function () {
   *     return downloadTarballFromGithub(url, file);
   * })
 * // This request will be paused
 * .then(function (file) {
   *     doStuffWith(file);
   * });
 */
export default class Queue {
  static LocalPromise: PromiseConstructor = Promise;
  options: QueueOptions;
  pendingPromises: number = 0;
  maxPendingPromises: number = Infinity;
  maxQueuedPromises: number = Infinity;
  queue: QueueItem[] = [];
  constructor(maxPendingPromises: number, maxQueuedPromises: number, options: QueueOptions) {
    this.options = options = options || {};
    this.maxPendingPromises = maxPendingPromises || Infinity;
    this.maxQueuedPromises = maxQueuedPromises || Infinity;
  }

  /**
   * Defines promise promiseFactory
   * @param {Function} GlobalPromise
   */
  static configure(GlobalPromise: PromiseConstructor) {
    Queue.LocalPromise = GlobalPromise;
  }

  /**
   * @param {Function} promiseGenerator
   * @return {LocalPromise}
   */
  add(promiseGenerator: Function) {
    return new Queue.LocalPromise((resolve, reject) => {
      // Do not queue to much promises
      if (this.queue.length >= this.maxQueuedPromises) {
        reject(new Error('Queue limit reached'));
        return;
      }

      // Add to queue
      this.queue.push({
        promiseGenerator,
        resolve,
        reject
        // notify: notify || noop
      });

      this._dequeue();
    });
  }

  /**
   * Number of simultaneously running promises (which are resolving)
   *
   * @return {number}
   */
  getPendingLength() {
    return this.pendingPromises;
  }

  /**
   * Number of queued promises (which are waiting)
   *
   * @return {number}
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * @returns {boolean} true if first item removed from queue
   * @private
   */
  _dequeue() {
    if (this.pendingPromises >= this.maxPendingPromises) {
      return false;
    }

    // Remove from queue
    const item = this.queue.shift();
    if (item === undefined) {
      if (this.options.onEmpty) {
        this.options.onEmpty();
      }
      return false;
    }

    try {
        this.pendingPromises++;

        Queue._resolveWith(item.promiseGenerator())
          // Forward all stuff
          .then((value: any) => {
            // It is not pending now
            this.pendingPromises--;
            // It should pass values
            item.resolve(value);
            this._dequeue();
          },    (err: Error) => {
            // It is not pending now
            this.pendingPromises--;
            // It should not mask errors
            item.reject(err);
            this._dequeue();
          }
            // ,function (message) {
            //   // It should pass notifications
            //   item.notify(message);
            // }
          );
      } catch (err) {
        this.pendingPromises--;
        item.reject(err);
        this._dequeue();

      }

    return true;
  }
  static _resolveWith(value: any) {
    if (value && typeof value.then === 'function') {
      return value;
    }

    return new Queue.LocalPromise(function (resolve) {
      resolve(value);
    });
  }
}
