import type { ReadStream } from 'fs'

import type { IOContext, InstanceOptions } from '@vtex/api'
import { AppClient } from '@vtex/api'
import { pathEq, pick } from 'ramda'
import type {
  QueryGetFileArgs,
  QueryGetFileUrlArgs,
  MutationUploadFileArgs,
  MutationDeleteFileArgs,
} from 'vtex.file-manager-graphql'

import { FileNotFound } from '../exceptions/fileNotFound'
import { InternalServerError } from '../exceptions/internalServerError'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const DEFAULT_BUCKET = 'images'
const DEFAULT_WIDTH = 1
const DEFAULT_HEIGHT = 2
const DEFAULT_ASPECT = false

const FORWARD_FIELDS = ['status', 'statusText', 'data', 'stack', 'stackTrace']

const routes = {
  Assets: () => `/assets/${runningAppName}`,
  FileUpload: (bucket: string, path: string) =>
    `${routes.Assets()}/save/${bucket}/${path}`,
  FileUrl: (bucket: string, path: string) =>
    `${routes.Assets()}/route/${bucket}/${path}`,
  FileDelete: (bucket: string, path: string) =>
    `${routes.Assets()}/delete/${bucket}/${path}`,
  File: (
    path: string,
    width: number,
    height: number,
    aspect: boolean,
    bucket: string
  ) =>
    `${routes.Assets()}/${bucket}/${path}?width=${width}&height=${height}&aspect=${aspect}`,
}

export default class FileManager extends AppClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('vtex.file-manager@0.x', context, options)

    if (runningAppName === '') {
      throw new InternalServerError(
        `Invalid path to access FileManger. Variable VTEX_APP_ID is not available.`
      )
    }
  }

  public getFile = async ({
    path,
    width,
    height,
    aspect,
    bucket,
  }: QueryGetFileArgs) => {
    try {
      return await this.http.get(
        routes.File(
          path,
          width ?? DEFAULT_WIDTH,
          height ?? DEFAULT_HEIGHT,
          aspect ?? DEFAULT_ASPECT,
          bucket ?? DEFAULT_BUCKET
        )
      )
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }

  public getFileUrl = async ({ bucket, path }: QueryGetFileUrlArgs) => {
    try {
      return await this.http.get(routes.FileUrl(bucket ?? DEFAULT_BUCKET, path))
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }

  public saveFile = async (
    file: IncomingFile,
    stream: ReadStream,
    bucket: MutationUploadFileArgs['bucket']
  ) => {
    try {
      const { filename, encoding, mimetype } = file
      const headers = {
        'Content-Type': mimetype,
        'Content-Encoding': encoding,
      }

      const response = await this.http.put<string>(
        routes.FileUpload(bucket ?? DEFAULT_BUCKET, filename),
        stream,
        {
          headers,
        }
      )

      return response
    } catch (e) {
      const status = e.statusCode || e?.response?.status || 500
      const extensions = pick(FORWARD_FIELDS, e.response)

      throw new InternalServerError(extensions, 'Fail to save file', status)
    }
  }

  public deleteFile = async ({ path, bucket }: MutationDeleteFileArgs) => {
    try {
      const response = await this.http.delete(
        routes.FileDelete(bucket ?? DEFAULT_BUCKET, path)
      )

      return response
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }
}
