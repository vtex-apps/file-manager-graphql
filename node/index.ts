import { Service } from '@vtex/api'

import { resolvers } from './resolvers'

export default new Service({
  graphql: {
    resolvers,
  },
})
