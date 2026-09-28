/** Thrown by limitStreamSize when a stream crosses the configured byte limit. Distinct type so
 * FileManager.saveFile can map it to a 4xx client error instead of the generic 500 it uses for
 * other stream failures. */
export class FileSizeLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileSizeLimitError'
  }
}
