import type {
  QueryGetFileArgs,
  QueryGetFilesArgs,
  QueryGetFileUrlArgs,
  MutationUploadFileArgs,
  MutationDeleteFileArgs,
  PagedFilesResponse,
  MutationUploadFilesArgs,
  FileUploadResponse,
} from 'vtex.file-manager-graphql'
import type { AxiosError } from 'axios'

import { uploadFile, getFiles, deleteFile } from '../services/upload'

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
    // --- New: Hackathon
    getFiles: (
      _root: null,
      args: QueryGetFilesArgs,
      { clients: { masterData } }: Context
    ): Promise<PagedFilesResponse> => {
      return getFiles({ masterData, args })
    },
  },
  Mutation: {
    uploadFile: (
      _root: null,
      args: MutationUploadFileArgs,
      { clients: { fileManager, masterData } }: Context
    ) => {
      return uploadFile({ client: fileManager, masterData, args })
    },
    deleteFile: async (
      _root: null,
      args: MutationDeleteFileArgs,
      { clients: { fileManager, masterData } }: Context
    ) => {
      await deleteFile({ client: fileManager, masterData, args })

      return true
    },

    // --- New: Hackathon
    uploadFiles: async (
      _root: null,
      args: MutationUploadFilesArgs,
      { clients: { fileManager, masterData } }: Context
    ): Promise<FileUploadResponse[]> => {
      const { files, bucket } = args
      const responses = await Promise.allSettled(
        files.map(async (file) =>
          uploadFile({
            client: fileManager,
            masterData,
            args: {
              bucket,
              file,
            },
          })
        )
      )

      return Promise.all(
        responses.map(async (response, index) => {
          const { filename: name, mimetype, encoding } = await files[index]

          return {
            file: {
              id: response.status === 'fulfilled' ? response.value.id : null,
              url:
                response.status === 'fulfilled' ? response.value.fileUrl : null,
              name,
              mimetype,
              encoding,
              extension: name.split('.').reverse()[0],
            },
            success: response.status === 'fulfilled',
            errorCode:
              response.status === 'rejected'
                ? (response.reason as AxiosError).response?.status
                : null,
            errorMessage:
              response.status === 'rejected'
                ? (response.reason as AxiosError).response?.statusText
                : null,
          }
        })
      )
    },
  },
}
