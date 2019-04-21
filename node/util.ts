import { Readable } from 'stream'

export const jsonStream = (data: any) => {
  var stream = new Readable();
  stream.push(JSON.stringify(data));
  stream.push(null);
  return stream
}
