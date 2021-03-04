import type { RecorderState, ParamsContext } from '@vtex/api'
import { Service } from '@vtex/api'

import { resolvers } from './resolvers'
import type { Clients } from './clients'
import { clients } from './clients'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  graphql: {
    resolvers,
  },
})
