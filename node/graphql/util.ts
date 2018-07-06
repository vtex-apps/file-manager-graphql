import { Readable } from 'stream'

export const jsonStream = (data) => {
  var stream = new Readable();
  stream.push(JSON.stringify(data));
  stream.push(null);
  return stream
}
