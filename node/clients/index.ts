import type { ClientsConfig } from '@vtex/api'
import { Sphinx, IOClients } from '@vtex/api'

import { VtexID } from './id'

const DEFAULT_CLIENT_TIMEOUT = 2 * 60000

export class Clients extends IOClients {
  public get vtexID() {
    return this.getOrSet('vtexID', VtexID)
  }

  public get sphinx() {
    return this.getOrSet('sphinx', Sphinx)
  }
}

export const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 1,
      timeout: DEFAULT_CLIENT_TIMEOUT,
    },
  },
}
