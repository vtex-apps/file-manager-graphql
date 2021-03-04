import { IOClient } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'
import type { Image, ImageSearchParameters } from 'master-data'

const MASTER_DATA_CLIENT_RETRIES = 3
const MASTER_DATA_CLIENT_TIMEOUT = 5000
const MAX_SEARCH_LIMIT = 100

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

  public searchImage = this.getDocumentSearcher<Image>(IMAGE_DATA_ENTITY, [
    'id',
    'url',
    'name',
    'encoding',
    'mimetype',
    'extension',
  ])

  public fetchImageById = this.getDocumentFetcherById<Image>(
    IMAGE_DATA_ENTITY,
    ['id', 'url', 'name', 'encoding', 'mimetype', 'extension']
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

  private getDocumentSearcher<T>(
    dataEntityName: string,
    fields?: Array<Extract<keyof T, string>>
  ) {
    return (searchParams: ImageSearchParameters) => {
      const { first, offset, ...generalParams } = searchParams

      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new Error(`The maximum value for "first" is ${MAX_SEARCH_LIMIT}`)
      }

      const lowerLimit =
        typeof offset !== 'undefined' && offset !== null ? offset : 0

      if (!Number.isSafeInteger(offset) || offset < 1) {
        throw new Error(
          'The "first" parameter must be an interger bigger than 1.'
        )
      }

      const upperLimit =
        lowerLimit +
        (Number.isSafeInteger(first) ? first : MAX_SEARCH_LIMIT - 1)

      const headers = {
        'REST-Range': `resources=${lowerLimit}-${upperLimit}`,
      }

      return this.http.getRaw<T[]>(`/${dataEntityName}/search`, {
        headers,
        params: {
          ...this.getFieldsParams(fields),
          _schema: this.schemaName,
          ...generalParams,
        },
      })
    }
  }

  private getFieldsParams(fields?: string[]) {
    return {
      _fields: fields && fields.length > 0 ? fields.join(',') : '_all',
    }
  }
}
