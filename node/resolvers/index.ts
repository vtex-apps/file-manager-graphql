import { v4 as uuidv4 } from 'uuid'
import type {
  QueryGetFileArgs,
  QueryGetFileUrlArgs,
  MutationUploadFileArgs,
  MutationDeleteFileArgs,
} from 'vtex.file-manager-graphql'

import FileManager from '../FileManager'

export const resolvers = {
  Query: {
    getFile: async (_root: null, args: QueryGetFileArgs, ctx: Context) => {
      // TODO: Move to clients
      const fileManager = new FileManager(ctx.vtex)

      return fileManager.getFile(args)
    },
    getFileUrl: async (
      _root: null,
      args: QueryGetFileUrlArgs,
      ctx: Context
    ) => {
      const fileManager = new FileManager(ctx.vtex)

      return fileManager.getFileUrl(args)
    },
    settings: async (_root: null, _args: null, _ctx: Context) => ({
      maxFileSizeMB: 4,
    }),
  },
  Mutation: {
    uploadFile: async (
      _root: null,
      args: MutationUploadFileArgs,
      ctx: Context
    ) => {
      const fileManager = new FileManager(ctx.vtex)
      const { file, bucket } = args
      const { stream, filename: name, mimetype, encoding } = await file
      const [extension] = name?.split('.')?.reverse()
      const filename = `${uuidv4()}.${extension}`

      const incomingFile = { filename, mimetype, encoding }

      return {
        encoding,
        mimetype,
        fileUrl: await fileManager.saveFile(incomingFile, stream, bucket),
      }
    },
    deleteFile: async (
      _root: null,
      args: MutationDeleteFileArgs,
      ctx: Context
    ) => {
      const fileManager = new FileManager(ctx.vtex)

      await fileManager.deleteFile(args)

      return true
    },
  },
}
