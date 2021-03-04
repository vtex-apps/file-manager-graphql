import { Service } from '@vtex/api'

import { resolvers } from './resolvers'
import type { Clients } from './clients'
import { clients } from './clients'

export default new Service<Clients>({
  clients,
  graphql: {
    resolvers,
  },
})
