/** An error that is safe to show to the caller. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: { retryAfterSeconds?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = () => new AppError(401, 'unauthorized', 'Sign in to continue.');
export const forbidden = () => new AppError(403, 'forbidden', 'You do not have access to this.');
export const notFound = () => new AppError(404, 'not_found', 'Not found.');
