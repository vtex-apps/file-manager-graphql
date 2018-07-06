import FileManager from './FileManager'
import {jsonStream} from './util'

export const resolvers = {
  Query: {
    getFileUrl: async (_, {filePath}, ctx) => {
      const fileManager = new FileManager(ctx.vtex)
      const fileUrl = await fileManager.getFileUrl(filePath)
      return {fileUrl}
    }
  },
  Mutation: {
    uploadFile: async (_, {upload}, ctx) => {
      const { stream, filename, mimetype, encoding } = await upload
      // const gimenes = {
      //   ele: "é legal"
      // }
      // const stream = jsonStream(gimenes)
      const fileManager = new FileManager(ctx.vtex)
      const fileUrl = await fileManager.saveFile(filename, stream, mimetype, encoding)
      return {fileUrl}
    },
  },
}
