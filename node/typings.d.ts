declare global {
  import type { Clients } from './clients'
  import type { ServiceContext } from '@vtex/api'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FIXME = any

  type Context = ServiceContext<Clients>

  interface IncomingFile {
    filename: string
    mimetype: string
    encoding: string
  }
}

export {}
