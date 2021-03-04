declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FIXME = any

  type Context = ServiceContext

  interface IncomingFile {
    filename: string
    mimetype: string
    encoding: string
  }
}

export {}
