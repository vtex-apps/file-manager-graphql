declare global {
  interface IncomingFile {
    filename: string
    mimetype: string
    encoding: string
  }
}

export {}
