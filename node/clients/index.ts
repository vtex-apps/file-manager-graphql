import type { ClientsConfig } from '@vtex/api'
import { IOClients } from '@vtex/api'

import FileManager from './FileManager'

export class Clients extends IOClients {
  public get fileManager(): FileManager {
    return this.getOrSet('fileManager', FileManager)
  }
}

export const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {},
}
