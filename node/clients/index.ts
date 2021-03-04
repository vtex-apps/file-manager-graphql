import type { ClientsConfig } from '@vtex/api'
import { IOClients } from '@vtex/api'

import MasterData from './MasterData'
import FileManager from './FileManager'

export class Clients extends IOClients {
  public get fileManager(): FileManager {
    return this.getOrSet('fileManager', FileManager)
  }

  public get masterData(): MasterData {
    return this.getOrSet('masterData', MasterData)
  }
}

export const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {},
}
