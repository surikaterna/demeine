import { Callback } from '../repository/Repository.interfaces';

export function nodeify<T>(promise: Promise<T>, callback?: Callback<T>): Promise<T> {
  if (!callback) {
    return promise;
  }

  promise.then(
    (result) => callback(null, result),
    (error) => callback(error)
  );

  return promise;
}
