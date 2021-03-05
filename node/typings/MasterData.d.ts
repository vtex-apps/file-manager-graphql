declare module 'master-data' {
  import type Maybe from 'graphql/tsutils/Maybe'

  export interface Image {
    id: string
    url: string
    name: string
    mimetype: string
    extension: string
    encoding: string
  }

  export interface ImageSearchParameters {
    mimetype?: string
    extension?: string
    name?: string
    _where?: Maybe<string>
    _fields?: string
    _keyword?: string
    _schema?: string
    _sort?: string
    first: number
    offset: number
  }
}
