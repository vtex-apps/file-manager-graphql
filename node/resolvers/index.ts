import { v4 as uuidv4 } from 'uuid'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
// eslint-disable-next-line prettier/prettier 
import type { ServiceContext } from '@vtex/api'

import FileManager from '../FileManager'
import { Readable } from 'stream'


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

  if (!extension || !mimetype) {
    return false
  }

  // Normalize extension to lowercase
  const normalizedExtension = extension.toLowerCase()

  // Define allowed file types with their corresponding MIME types
  const allowedFileTypes = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
}

  if(!(extension in allowedFileTypes)) {
    return false
  }

  return normalizedExtension in allowedFileTypes && allowedFileTypes[normalizedExtension as keyof typeof allowedFileTypes] === mimetype
}

const sanitizeSvgFile = async (loadedFile: any) => {
    const fileBuffer = await loadedFile.createReadStream().toArray()
    const fileString = Buffer.concat(fileBuffer).toString('utf8')
        
    const {window} = new JSDOM('')
    const DOMPurify = createDOMPurify(window)

    const cleanSvgString = DOMPurify.sanitize(fileString, {
      USE_PROFILES: { svg: true },
    })
    
    return {
      isSafe: typeof cleanSvgString === 'string' &&
      cleanSvgString.trim().length > 0 &&
      cleanSvgString.includes('<svg'),
      sanitizedContent: cleanSvgString,
    }
}

export const resolvers = {
  Query: {
    getFile: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = new FileManager(ctx.vtex)
      const { path, width, height, aspect, bucket } = args

      const file = await fileManager.getFile({path, width, height, aspect, bucket})

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
      let loadedFile = await file
      const {filename: name, mimetype, encoding } = loadedFile
      const [extension] = name?.split('.')?.reverse()

      if (!isValidFileFormat(extension, mimetype)) {
        throw new Error('Invalid file format') 
      }

      // Validate SVG files separately
      // SVG files require additional validation to prevent XSS attacks
      // and other security issues, so we check if the file is SVG
      // and sanitize it if necessary.         

      if (mimetype === 'image/svg+xml') {             
        const {isSafe, sanitizedContent} = await sanitizeSvgFile(loadedFile)
          if (!isSafe) {            
            throw new Error('Forced attempt to upload unsafe SVG file with no valid content')
          }
          
        const sanitizedBuffer = Buffer.from(sanitizedContent, 'utf8')

        loadedFile.createReadStream = () => Readable.from(sanitizedBuffer)  
      }

      const filename = `${uuidv4()}.${extension}`
      const stream = loadedFile.createReadStream()

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
