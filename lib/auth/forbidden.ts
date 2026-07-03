/** Standard 403 for authenticated but unauthorized users. */
export class ForbiddenError extends Error {
  readonly status = 403

  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof ForbiddenError
}
