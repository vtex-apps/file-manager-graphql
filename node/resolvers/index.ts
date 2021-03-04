import { v4 as uuidv4 } from 'uuid'
import type {
  QueryGetFileArgs,
  QueryGetFileUrlArgs,
  MutationUploadFileArgs,
  MutationDeleteFileArgs,
} from 'vtex.file-manager-graphql'

export const resolvers = {
  Query: {
    getFile: async (
      _root: null,
      args: QueryGetFileArgs,
      { clients: { fileManager } }: Context
    ) => {
      return fileManager.getFile(args)
    },
    getFileUrl: async (
      _root: null,
      args: QueryGetFileUrlArgs,
      { clients: { fileManager } }: Context
    ) => {
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
      { clients: { fileManager } }: Context
    ) => {
      const { file, bucket } = args
      const {
        createReadStream,
        filename: name,
        mimetype,
        encoding,
      } = await file

      const [extension] = name?.split('.')?.reverse()
      const filename = `${uuidv4()}.${extension}`

      const incomingFile = { filename, mimetype, encoding }

      return {
        encoding,
        mimetype,
        fileUrl: await fileManager.saveFile(
          incomingFile,
          createReadStream(),
          bucket
        ),
      }
    },
    deleteFile: async (
      _root: null,
      args: MutationDeleteFileArgs,
      { clients: { fileManager } }: Context
    ) => {
      await fileManager.deleteFile(args)

      return true
    },
  },
}
