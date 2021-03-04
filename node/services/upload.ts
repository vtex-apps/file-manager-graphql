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
    name,
    encoding,
    mimetype,
    fileUrl: await client.saveFile(incomingFile, createReadStream(), bucket),
  }

  const masterDataFile = await masterData.createImage({
    id,
    name: uploadedFile.name,
    mimetype: uploadedFile.mimetype,
    url: uploadedFile.fileUrl,
    encoding: uploadedFile.encoding,
  })

  return {
    id: masterDataFile.DocumentId,
    ...uploadedFile,
  }
}
