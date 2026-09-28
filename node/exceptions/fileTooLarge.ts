export class FileTooLarge extends Error {
  constructor(
    public extensions: any,
    public message = 'File exceeds the maximum allowed size',
    public statusCode = 413
  ) {
    super(message)
  }
}
