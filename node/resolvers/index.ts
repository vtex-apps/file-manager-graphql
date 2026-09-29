import { v4 as uuidv4 } from 'uuid'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
// eslint-disable-next-line prettier/prettier 
import type { ServiceContext } from '@vtex/api'

import { Readable, Transform, pipeline } from 'stream'

import { resolveUserToken } from '../directives/auth'
import FileManager from '../FileManager'
import { withPolicyLogging } from '../utils/policyLogger'
import { FileSizeLimitError } from '../exceptions/fileSizeLimitError'


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

type GetBucketPolicyArgs = {
  bucket: string
  app?: string | null
}

type SetBucketPolicyArgs = {
  bucket: string
  readAccess: string
  writeAccess: string
  app?: string | null
}

type DeleteBucketPolicyArgs = {
  bucket: string
  app?: string | null
}

export const MAX_FILE_SIZE_MB = 4

/* @vtex/api's graphqlUploadKoa middleware already truncates uploads at 4 * 1e6 bytes
 * (upload.js, maxFileSize) before this resolver ever reads the stream. Align to that value --
 * a larger threshold here (e.g. 4 * 1024 * 1024) would never actually trigger, since the
 * framework's smaller limit always fires first. */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1e6

/** Errors out as soon as the stream crosses maxBytes, instead of after buffering/forwarding the whole payload. */
export const limitStreamSize = (stream: Readable, maxBytes: number): Readable => {
  let total = 0

  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length
      if (total > maxBytes) {
        callback(new FileSizeLimitError(`File exceeds the maximum allowed size of ${maxBytes} bytes`))
        return
      }

      callback(null, chunk)
    },
  })

  /* `pipeline` (unlike `.pipe()`) tears down both ends on a failure in either direction: a source
   * error reaches the consumer, and crossing maxBytes destroys the source instead of leaving it
   * open. Its callback is mandatory; the error itself still surfaces on the returned stream. */
  return pipeline(stream, transform, () => undefined)
}

/* Every resolver needs the same client, built with the caller's own token: the app token
 * authorizes the hop, the user token identifies the caller for file-manager's policy checks.
 * Centralized so adding a constructor argument stays a one-line change (it previously had to be
 * repeated across all 8 resolvers in lockstep). */
const fileManagerFor = (ctx: ServiceContext) =>
  new FileManager(ctx.vtex, undefined, resolveUserToken(ctx))

const policyLogContext = (
  operation: string,
  bucket: string | null,
  ctx: ServiceContext
) => ({
  operation,
  bucket,
  account: ctx.vtex.account,
  workspace: ctx.vtex.workspace,
})

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
    const fileBuffer = await limitStreamSize(loadedFile.createReadStream(), MAX_FILE_SIZE_BYTES).toArray()
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
      const fileManager = fileManagerFor(ctx)
      const { path, width, height, aspect, bucket } = args

      const file = await fileManager.getFile({path, width, height, aspect, bucket})

      return file
    },
    getFileUrl: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
      const { path, bucket } = args

      const file = await fileManager.getFileUrl(path, bucket)

      return file
    },
    settings: async () => ({
      maxFileSizeMB: MAX_FILE_SIZE_MB,
    }),
    listBucketPolicies: async (_: unknown, __: unknown, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)

      return withPolicyLogging(
        policyLogContext('listBucketPolicies', null, ctx),
        async () => {
          const allPolicies: any[] = []
          let marker: string | undefined

          do {
            const page = await fileManager.listPolicies(marker)
            allPolicies.push(...page.policies)
            marker = page.nextMarker ?? undefined
          } while (marker)

          return allPolicies
        }
      )
    },
    getBucketPolicy: async (_: unknown, args: GetBucketPolicyArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
      const { bucket, app } = args

      return withPolicyLogging(
        policyLogContext('getBucketPolicy', bucket, ctx),
        () => fileManager.getPolicy(bucket, app)
      )
    },
  },
  Mutation: {
    uploadFile: async (_: unknown, args: UploadFileArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
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

      /* Sanitization runs before file-manager authorizes the write, so an unauthorized caller
       * still pays its CPU cost. Accepted on purpose: a pre-check here would need a second
       * authorization source (the /access-levels route this PR removed, see 4d30042) that could
       * drift from the one the write itself applies, and it would save no I/O anyway --
       * graphql-upload spools the whole body to a temp file before this resolver runs. The
       * worst case per request is bounded by MAX_FILE_SIZE_BYTES. */
      if (mimetype === 'image/svg+xml') {             
        const {isSafe, sanitizedContent} = await sanitizeSvgFile(loadedFile)
          if (!isSafe) {            
            throw new Error('Forced attempt to upload unsafe SVG file with no valid content')
          }
          
        const sanitizedBuffer = Buffer.from(sanitizedContent, 'utf8')

        loadedFile.createReadStream = () => Readable.from(sanitizedBuffer)  
      }

      const filename = `${uuidv4()}.${extension}`
      const stream = limitStreamSize(loadedFile.createReadStream(), MAX_FILE_SIZE_BYTES)

      const incomingFile = { filename, mimetype, encoding }

      return {
        encoding,
        mimetype,
        fileUrl: await fileManager.saveFile(incomingFile, stream, bucket),
      }
    },
    deleteFile: async (_: unknown, args: FileManagerArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
      const { path, bucket } = args

      await fileManager.deleteFile(path, bucket)

      return true
    },
    setBucketPolicy: async (_: unknown, args: SetBucketPolicyArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
      const { bucket, readAccess, writeAccess, app } = args

      return withPolicyLogging(
        policyLogContext('setBucketPolicy', bucket, ctx),
        () => fileManager.setAdminPolicy(bucket, readAccess, writeAccess, app)
      )
    },
    deleteBucketPolicy: async (_: unknown, args: DeleteBucketPolicyArgs, ctx: ServiceContext) => {
      const fileManager = fileManagerFor(ctx)
      const { bucket, app } = args

      return withPolicyLogging(
        policyLogContext('deleteBucketPolicy', bucket, ctx),
        () => fileManager.deleteAdminPolicy(bucket, app)
      )
    },
  },
}
