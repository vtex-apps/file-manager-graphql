export class FileNotFound extends Error {
  constructor(
    public extensions,
    public message = 'File Not Found',
    public statusCode = 404,
  ) {
    super(message)
  }
}
