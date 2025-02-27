import { resolvers } from './resolvers'
import { Service } from '@vtex/api'

export default new Service({
  graphql: {
    resolvers
  }
})
