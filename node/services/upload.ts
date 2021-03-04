import { v4 as uuidv4 } from 'uuid'
import type { MutationUploadFileArgs } from 'vtex.file-manager-graphql'

import type FileManager from '../clients/FileManager'

export async function uploadFile({
  client,
  args,
}: {
  client: FileManager
  args: MutationUploadFileArgs
}) {
  const { file, bucket } = args
  const { createReadStream, filename: name, mimetype, encoding } = await file

  const [extension] = name?.split('.')?.reverse()
  const assetId = uuidv4()
  const filename = `${assetId}.${extension}`

  const incomingFile = { filename, mimetype, encoding }

  return {
    assetId,
    name,
    encoding,
    mimetype,
    fileUrl: await client.saveFile(incomingFile, createReadStream(), bucket),
  }
}
