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

import { uploadFile } from '../services/upload'

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
      _ctx: Context
    ): PagedFilesResponse => {
      const {
        params: {
          filter: { page, perPage },
        },
      } = args

      const data = Array(args.params.filter.perPage)

      data.fill({
        id: 'dbb14472-af35-4993-92a1-eeebd054be19',
        name: 'banner-custom.png',
        mimetype: 'image/png',
        encoding: '7bit',
        url:
          'https://storecomponents.vtexassets.com/assets/vtex.file-manager-graphql/images/dbb14472-af35-4993-92a1-eeebd054be19___8ae8396388e19678ddc56b1097692c98.png?width=100&height=200',
      })

      return {
        data,
        paging: {
          page,
          perPage,
          total: page * perPage + 1,
          pages: page + 1,
        },
      }
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
      { clients: { fileManager } }: Context
    ) => {
      await fileManager.deleteFile(args)

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
