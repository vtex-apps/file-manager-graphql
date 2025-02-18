import { resolvers } from './resolvers'
import { Clients } from './clients'
import { ClientsConfig, Service } from '@vtex/api'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 2000,
    },
  }
}

export default new Service({
  clients,
  graphql: {
    resolvers
  }
})
