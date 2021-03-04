import { IOClient } from '@vtex/api'
import type { Image } from 'master-data'
import type { InstanceOptions, IOContext } from '@vtex/api'

const MASTER_DATA_CLIENT_RETRIES = 3
const MASTER_DATA_CLIENT_TIMEOUT = 5000

const MASTER_DATA_SCHEMA_NAME = 'image'
const IMAGE_DATA_ENTITY = 'vtex_admin_media_image'

export default class MasterData extends IOClient {
  private schemaName: string

  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super(ctx, {
      ...opts,
      timeout: MASTER_DATA_CLIENT_TIMEOUT,
      retries: MASTER_DATA_CLIENT_RETRIES,
      baseURL: `http://api.vtex.com/${ctx.account}/dataentities`,
      headers: {
        ...opts?.headers,
        'Content-Type': 'application/json',
        'Proxy-Authorization': ctx.authToken,
        ...(ctx.adminUserAuthToken && {
          VtexIdclientAutCookie: ctx.adminUserAuthToken,
        }),
      },
    })

    this.schemaName = MASTER_DATA_SCHEMA_NAME
  }

  public createImage = this.getDocumentCreator<Image>(IMAGE_DATA_ENTITY)

  public fetchImageById = this.getDocumentFetcherById<Image>(
    IMAGE_DATA_ENTITY,
    ['id', 'url', 'name', 'encoding', 'mimetype', 'assetId']
  )

  private getDocumentCreator<T>(dataEntityName: string) {
    return (data: T) =>
      this.http.post<{
        DocumentId: string
        Href: string
        Id: string
      }>(`/${dataEntityName}/documents`, data, {
        params: { _schema: this.schemaName },
      })
  }

  private getDocumentFetcherById<T>(
    dataEntityName: string,
    fields?: Array<Extract<keyof T, string>>
  ) {
    return (id: string) =>
      this.http.get<T | ''>(`/${dataEntityName}/documents/${id}`, {
        params: this.getFieldsParams(fields),
      })
  }

  private getFieldsParams(fields?: string[]) {
    return {
      _fields: fields && fields.length > 0 ? fields.join(',') : '_all',
    }
  }
}
