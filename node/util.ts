import { Readable } from 'stream'

export const jsonStream = (data: FIXME) => {
  const stream = new Readable()

  stream.push(JSON.stringify(data))
  stream.push(null)

  return stream
}
