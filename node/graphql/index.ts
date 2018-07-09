import {GraphQLUpload} from 'apollo-upload-server'
import FileManager from './FileManager'

export const resolvers = {
  Query: {
    getFileUrl: async (_, {filePath}, ctx) => {
      const fileManager = new FileManager(ctx.vtex)
      const fileUrl = await fileManager.getFileUrl(filePath)
      return {fileUrl}
    }
  },
  Mutation: {
    uploadFile: async (obj, {file}, ctx, info) => {
      const { stream, filename, mimetype, encoding } = await file
      const fileManager = new FileManager(ctx.vtex)
      const fileUrl = await fileManager.saveFile(filename, stream, mimetype, encoding)
      return {fileUrl}
    },
  },
  Upload: GraphQLUpload
}
