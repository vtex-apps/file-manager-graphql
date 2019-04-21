import FileManager from '../FileManager'

export const resolvers = {
  Query: {
    getFile: async (_: any, args: any, ctx: any, __: any) =>  {
      const fileManager = new FileManager(ctx.vtex)
      const {path, width, height, aspect, bucket} = args
      return await fileManager.getFile(path, width, height, aspect, bucket)
    },
    getFileUrl: async (_: any, args: any, ctx: any, __: any) => {
      const fileManager = new FileManager(ctx.vtex)
      const {path, bucket} = args
      return await fileManager.getFileUrl(path, bucket)
    },
    settings: async (_: any, __: any, ___: any, ____: any) => ({
      maxFileSizeMB: 4
    }),
  },
  Mutation: {
    uploadFile: async (_: any, args: any, ctx: any, __: any) => {
      const fileManager = new FileManager(ctx.vtex)
      const {file, bucket} = args
      const {stream, filename, mimetype, encoding} = await file
      const incomingFile = {filename, mimetype, encoding}
      return {
        encoding,
        mimetype,
        fileUrl: await fileManager.saveFile(incomingFile, stream, bucket),
      }
    },
    deleteFile: async (_: any, args: any, ctx: any, __: any) => {
      const fileManager = new FileManager(ctx.vtex)
      const {path, bucket} = args
      await fileManager.deleteFile(path, bucket)
      return true
    }
  }
}
