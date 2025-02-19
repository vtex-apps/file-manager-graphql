import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service } from '@vtex/api'

import { resolvers } from './resolvers'
import type { Clients } from './clients'
import { clients } from './clients'
import { Authorization } from './directives/auth'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  graphql: {
    resolvers,
    schemaDirectives: {
      requiresAuth: Authorization,
    },
  },
})
