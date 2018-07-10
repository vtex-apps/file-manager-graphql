export class InternalServerError extends Error {
  constructor(
    public extensions,
    public message = 'Internal Server Error',
    public statusCode = 500,
  ) {
    super(message)
  }
}
