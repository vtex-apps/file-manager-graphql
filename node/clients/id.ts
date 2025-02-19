import { ExternalClient, InstanceOptions, IOContext } from '@vtex/api'

const userAgent = process.env.VTEX_APP_ID!

export class VtexID extends ExternalClient {
  public constructor(context: IOContext, options?: InstanceOptions) {
    super('http://vtexid.vtex.com.br/api/vtexid', context, options)
  }

  public getIdUser = (token: string, authToken: string) =>
    this.http.get(`pub/authenticated/user`, {
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-VTEX-Proxy-To': 'https://vtexid.vtex.com.br',
        'X-Vtex-Use-Https': true,
      },
      metric: 'vtexid-authtoken',
      params: {
        authToken: token,
      },
    })
}