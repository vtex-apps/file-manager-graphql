import {HttpClient, IOContext, InstanceOptions} from '@vtex/api'
import {FileNotFound} from './exceptions/fileNotFound'
import {InternalServerError} from './exceptions/internalServerError'
import {pathEq, path, pick} from 'ramda'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const FORWARD_FIELDS = ['status', 'statusText', 'data', 'stack', 'stackTrace']

const routes = {
  Assets: () => `/assets/${runningAppName}`,
  FileUpload: (bucket: string, path: string) => `${routes.Assets()}/save/${bucket}/${path}`,
  FileUrl: (bucket: string, path: string) => `${routes.Assets()}/route/${bucket}/${path}`,
  FileDelete: (bucket: string, path: string) => `${routes.Assets()}/delete/${bucket}/${path}`,
  File: (path: string, width: number, height: number, aspect: boolean, bucket: string) => `${routes.Assets()}/${bucket}/${path}?width=${width}&height=${height}&aspect=${aspect}`
}

export default class FileManager {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    if (runningAppName === '') {
      throw new InternalServerError(`Invalid path to access FileManger. Variable VTEX_APP_ID is not available.`)
    }
    this.http = HttpClient.forWorkspace('file-manager.vtex', ioContext, opts)
  }

  getFile = async (path: string, width: number, height: number, aspect: boolean, bucket: string) => {
    try {
      return await this.http.get(routes.File(path, width, height, aspect, bucket))
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }

  getFileUrl = async (path: string, bucket: string) => {
    try {
      return await this.http.get(routes.FileUrl(bucket, path))
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }

  saveFile = async (file: IncomingFile, stream, bucket: string) => {
    try {
      const {filename, encoding, mimetype} = file
      const headers = {
        'Content-Type': mimetype,
        'Content-Encoding': encoding,
      }
      return await this.http.put(routes.FileUpload(bucket, filename), stream, {headers})
    } catch (e) {
      const status = e.statusCode || path(['response', 'status'], e) || 500
      const extensions = pick(FORWARD_FIELDS, e.response)
      throw new InternalServerError(extensions, 'Fail to save file', status)
    }
  }

  deleteFile = async (path: string, bucket: string) => {
    try {
      return await this.http.delete(routes.FileDelete(bucket, path))
    } catch (e) {
      if (e.statusCode === 404 || pathEq(['response', 'status'], 404, e)) {
        throw new FileNotFound(pick(FORWARD_FIELDS, e.response))
      } else {
        throw e
      }
    }
  }
}
