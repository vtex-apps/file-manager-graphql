import { v4 as uuidv4 } from 'uuid'
import type {
  MutationUploadFileArgs,
  QueryGetFilesArgs,
  MutationDeleteFileArgs,
} from 'vtex.file-manager-graphql'

import type FileManager from '../clients/FileManager'
import type MasterData from '../clients/MasterData'

export async function uploadFile({
  client,
  masterData,
  args,
}: {
  client: FileManager
  masterData: MasterData
  args: MutationUploadFileArgs
}) {
  const { file, bucket } = args
  const { createReadStream, filename: name, mimetype, encoding } = await file

  const [extension] = name?.split('.')?.reverse()
  const id = uuidv4()
  const filename = `${id}.${extension}`

  const incomingFile = { filename, mimetype, encoding }

  const uploadedFile = {
    id,
    name,
    encoding,
    mimetype,
    extension,
    fileUrl: await client.saveFile(incomingFile, createReadStream(), bucket),
  }

  try {
    await masterData.createImage({
      id: uploadedFile.id,
      name: uploadedFile.name,
      mimetype: uploadedFile.mimetype,
      extension: uploadedFile.extension,
      encoding: uploadedFile.encoding,
      url: uploadedFile.fileUrl,
    })
  } catch (err) {
    await client.deleteFile({ bucket, path: filename })
    throw err
  }

  return uploadedFile
}

export async function getFiles({
  masterData,
  args,
}: {
  masterData: MasterData
  args: QueryGetFilesArgs
}) {
  const {
    params: {
      filter: { page, perPage, id, name, mimetype },
      sorting,
    },
  } = args

  const { data, headers } = await masterData.searchImage({
    first: perPage,
    offset: page - 1,
    _sort: `${sorting?.field ?? 'name'} ${sorting?.direction ?? 'ASC'}`,
    _where: id
      ? `id=${id}`
      : [
          name ? `(name="*${name}*")` : null,
          mimetype?.length
            ? // In case the query receives ['image'], match '*image*'
              `(${mimetype.map((type) => `mimetype="*${type}*"`).join(' OR ')})`
            : null,
        ]
          .filter((x) => x)
          .join(' AND '),
  })

  // 'rest-content-range': 'resources <offset>-<first>/<total>'
  const total = parseInt(headers['rest-content-range'].split('/')[1], 10)

  return {
    data,
    paging: {
      page,
      perPage,
      total,
      pages: Math.ceil(total / perPage),
    },
  }
}

export async function deleteFile({
  client,
  masterData,
  args,
}: {
  client: FileManager
  masterData: MasterData
  args: MutationDeleteFileArgs
}) {
  // First delete from file manager and if everything goes well, delete from MasterData
  await client.deleteFile(args)
  await masterData.deleteImageById(args.path.split('.')[0])
}
