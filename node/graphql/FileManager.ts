import { HttpClient,  IOContext, InstanceOptions} from '@vtex/api'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const bucket = 'images'

const routes = {
  Assets: () => `/assets/${runningAppName}`,
  FileUpload: (bucket: string, path: string) => `${routes.Assets()}/save/${bucket}/${path}`,
  FileUrl: (bucket: string, filePath: string) => `${routes.Assets()}/route/${bucket}/${filePath}`
}

export default class FileManager {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    if (runningAppName === '') {
      throw new Error(`Invalid path to access FileManger. Variable VTEX_APP_ID is not available.`)
    }
    this.http = HttpClient.forWorkspace('file-manager.vtex', ioContext, opts)
  }

  getFileUrl = async (filePath: string) => {
    console.log('getFileURL', routes.FileUrl(bucket, filePath))
    return this.http.get(routes.FileUrl(bucket, filePath))
  }

  saveFile = async (fileName: string, stream, mimetype, encoding) => {
    try {
      const headers: Headers = {}
      headers['Content-Type'] = mimetype
      headers['Content-Encoding'] = encoding

      return this.http.put(routes.FileUpload(bucket, fileName), stream, {headers})
    } catch (ex) {
      console.log(ex)
      throw new Error(`Failed to save file!`)
    }
  }
}
