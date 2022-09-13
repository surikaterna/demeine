export function checkIsError(err: unknown): err is Error {
  if (err instanceof Error) {
    return true;
  }

  return typeof err === 'object' && err !== null && 'message' in err;
}

export function getMessageFromError(err: unknown, defaultMessage = 'Cannot resolve message from error'): string {
  if (checkIsError(err)) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  return defaultMessage;
}
