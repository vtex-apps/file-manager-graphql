import { v4 as uuidv4 } from 'uuid'
import type { MutationUploadFileArgs } from 'vtex.file-manager-graphql'

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
