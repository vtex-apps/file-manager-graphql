import { v4 as uuidv4 } from 'uuid'

import FileManager from '../FileManager'
import { ServiceContext } from '@vtex/api'

type FileManagerArgs = {
  path: string
  width: number
  height: number
  aspect: boolean
  bucket: string
}

type UploadFileArgs = {
  file: Promise<any>
  bucket: string
}

const isValidFileFormat = (extension: string, mimetype: string) => {
  const allowedExtensions = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'pdf',
    'doc',
    'docx',
    'svg',
    'xls',
    'xlsx',
    'txt'
  ]
  
  const allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]

  return allowedExtensions.includes(extension) && allowedMimeTypes.includes(mimetype)
}

export const resolvers = {
  Query: {
    getFile: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = new FileManager(ctx.vtex)
      const { path, width, height, aspect, bucket } = args

      const file = await fileManager.getFile(path, width, height, aspect, bucket)
      return file
    },
    getFileUrl: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = new FileManager(ctx.vtex)
      const { path, bucket } = args

      const file = await fileManager.getFileUrl(path, bucket)
      return file
    },
    settings: async () => ({
      maxFileSizeMB: 4,
    }),
  },
  Mutation: {
    uploadFile: async (_: unknown, args: UploadFileArgs, ctx: ServiceContext) => {
      const fileManager = new FileManager(ctx.vtex)
      const { file, bucket } = args
      const loadedFile = await file
      const {filename: name, mimetype, encoding } = loadedFile
      const [extension] = name?.split('.')?.reverse()

      if (!isValidFileFormat(extension, mimetype)) {
        throw new Error('Invalid file format') 
      }

      const filename = `${uuidv4()}.${extension}`
      const stream = loadedFile.createReadStream(filename)

      const incomingFile = { filename, mimetype, encoding }

      return {
        encoding,
        mimetype,
        fileUrl: await fileManager.saveFile(incomingFile, stream, bucket),
      }
    },
    deleteFile: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = new FileManager(ctx.vtex)
      const { path, bucket } = args

      await fileManager.deleteFile(path, bucket)

      return true
    },
  },
}
