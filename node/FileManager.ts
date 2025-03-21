import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

import { FileNotFound } from './exceptions/fileNotFound'
import { InternalServerError } from './exceptions/internalServerError'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const FORWARD_FIELDS = ['status', 'statusText', 'data', 'stack', 'stackTrace']

const pickForwardFields = (object: any) => 
  ({ ...Object.fromEntries(FORWARD_FIELDS.map(field => [field, object[field]])) })

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

export default class FileManager extends ExternalClient {
 
  constructor(protected context: IOContext, options?: InstanceOptions) {
    super(
      `http://app.io.vtex.com/vtex.file-manager/v0/${context.account}/${context.workspace}`,
      context,
      {
        ...(options ?? {}),
        headers: {
          ...(options?.headers ?? {}),
          'VtexIdclientAutCookie': context.authToken,
          'Content-Type': 'application/json',
          'X-Vtex-Use-Https': 'true',
        },
      }
    )
  }

  getFile = async (
    path: string,
    width: number,
    height: number,
    aspect: boolean,
    bucket: string
  ) => {
    try {
      return await this.http.get(
        routes.File(path, width, height, aspect, bucket)
      )
    } catch (e) {      
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }

  getFileUrl = async (path: string, bucket: string) => {
    try {
      const fileUrl = routes.FileUrl(bucket, path)
      const file = await this.http.get(fileUrl)
      return file
    } catch (e) {
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }

  saveFile = async (file: IncomingFile, stream: any, bucket: string) => {
    try {
      const { filename, encoding, mimetype } = file
      const headers = {
        'Content-Type': mimetype,
        'Content-Encoding': encoding,
      }

      return await this.http.put(routes.FileUpload(bucket, filename), stream, {
        headers,
        metric: 'file-manager-save-file',
      })
    } catch (e) {
      const status = e.statusCode || e.response?.status || 500
      const extensions = pickForwardFields(e.response)

      throw new InternalServerError(extensions, 'Fail to save file', status)
    }
  }

  deleteFile = async (path: string, bucket: string) => {
    try {
      return await this.http.delete(routes.FileDelete(bucket, path), {
        metric: 'file-manager-delete-file',
      })
    } catch (e) {
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }
}
