import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

import { FileNotFound } from './exceptions/fileNotFound'
import { InternalServerError } from './exceptions/internalServerError'

const appId = process.env.VTEX_APP_ID
const [runningAppName] = appId ? appId.split('@') : ['']

const FORWARD_FIELDS = ['status', 'statusText', 'data', 'stack', 'stackTrace']

const pickForwardFields = (object: any) => 
  ({ ...Object.fromEntries(FORWARD_FIELDS.map(field => [field, object[field]])) })

const routes = {
  Assets: () => `/assets/${runningAppName}`,
  FileUpload: (bucket: string, path: string) =>
    `${routes.Assets()}/save/${bucket}/${path}`,
  FileUrl: (bucket: string, path: string) =>
    `${routes.Assets()}/route/${bucket}/${path}`,
  FileDelete: (bucket: string, path: string) =>
    `${routes.Assets()}/delete/${bucket}/${path}`,
  File: (
    path: string,
    width: number,
    height: number,
    aspect: boolean,
    bucket: string
  ) =>
    `${routes.Assets()}/${bucket}/${path}?width=${width}&height=${height}&aspect=${aspect}`,
}

export type GraphQLAccessLevel =
  | 'PUBLIC'
  | 'AUTHENTICATED'
  | 'ACCOUNT_ADMINISTRATOR'

export const toWireAccessLevel = (level: GraphQLAccessLevel): string => {
  switch (level) {
    case 'PUBLIC':
      return 'public'
    case 'AUTHENTICATED':
      return 'authenticated'
    case 'ACCOUNT_ADMINISTRATOR':
      return 'account-administrator'
    default:
      return level
  }
}

export const fromWireAccessLevel = (level: string): GraphQLAccessLevel => {
  switch (level) {
    case 'public':
      return 'PUBLIC'
    case 'authenticated':
      return 'AUTHENTICATED'
    case 'account-administrator':
      return 'ACCOUNT_ADMINISTRATOR'
    default:
      return 'PUBLIC'
  }
}

const mapBucketPolicyFromWire = (policy: any): any => {
  if (!policy) {
    return policy
  }

  return {
    ...policy,
    readAccess: fromWireAccessLevel(policy.readAccess),
    writeAccess: fromWireAccessLevel(policy.writeAccess),
  }
}

export const mapPolicyViewFromWire = (raw: any): any => {
  if (!raw) {
    return raw
  }

  return {
    ...raw,
    effectivePolicy: mapBucketPolicyFromWire(raw.effectivePolicy),
    manifestPolicy: raw.manifestPolicy
      ? mapBucketPolicyFromWire(raw.manifestPolicy)
      : null,
    adminPolicy: raw.adminPolicy
      ? mapBucketPolicyFromWire(raw.adminPolicy)
      : null,
  }
}

export default class FileManager extends ExternalClient {
 
  constructor(protected context: IOContext, options?: InstanceOptions, userToken?: string) {
    super(
      `http://app.io.vtex.com/vtex.file-manager/v0/${context.account}/${context.workspace}`,
      context,
      {
        ...(options ?? {}),
        headers: {
          ...(options?.headers ?? {}),
          ...(userToken ? { VtexIdclientAutCookie: userToken } : {}),
          'Content-Type': 'application/json',
          'X-Vtex-Use-Https': 'true',
        },
      }
    )
  }

  public getFile = async ({
    path,
    width,
    height,
    aspect,
    bucket,
  }: {
    path: string
    width: number
    height: number
    aspect: boolean
    bucket: string
  }) => {
    try {
      return await this.http.get(
        routes.File(path, width, height, aspect, bucket)
      )
    } catch (e) {
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }

  getFileUrl = async (path: string, bucket: string) => {
    try {
      const fileUrl = routes.FileUrl(bucket, path)
      const file = await this.http.get(fileUrl)
      return file
    } catch (e) {
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }

  saveFile = async (file: IncomingFile, stream: any, bucket: string) => {
    try {
      const { filename, encoding, mimetype } = file
      const headers = {
        'Content-Type': mimetype,
        'Content-Encoding': encoding,
      }

      return await this.http.put(routes.FileUpload(bucket, filename), stream, {
        headers,
        metric: 'file-manager-save-file',
      })
    } catch (e) {
      const status = e.statusCode || e.response?.status || 500
      const extensions = pickForwardFields(e.response)

      throw new InternalServerError(extensions, 'Fail to save file', status)
    }
  }

  deleteFile = async (path: string, bucket: string) => {
    try {
      return await this.http.delete(routes.FileDelete(bucket, path), {
        metric: 'file-manager-delete-file',
      })
    } catch (e) {
      if (e.statusCode === 404 || e.response?.status === 404) {
        throw new FileNotFound(pickForwardFields(e.response))
      } else {
        throw e
      }
    }
  }

  public listPolicies = async (
    marker?: string
  ): Promise<{ policies: any[]; nextMarker: string | null }> => {
    const qs = marker ? `?marker=${encodeURIComponent(marker)}` : ''
    const raw = await this.http.get(`/bucket-access-policies${qs}`)
    return {
      policies: Array.isArray(raw?.policies)
        ? raw.policies.map(mapPolicyViewFromWire)
        : [],
      nextMarker: raw?.nextMarker ?? null,
    }
  }

  public getPolicy = async (bucket: string): Promise<any> => {
    const raw = await this.http.get(`/bucket-access-policies/${bucket}`)
    return mapPolicyViewFromWire(raw)
  }

  public setAdminPolicy = async (
    bucket: string,
    readAccess: string,
    writeAccess: string
  ): Promise<any> => {
    const raw = await this.http.post(`/bucket-access-policies/${bucket}/admin`, {
      readAccess: toWireAccessLevel(readAccess as GraphQLAccessLevel),
      writeAccess: toWireAccessLevel(writeAccess as GraphQLAccessLevel),
    })
    return mapBucketPolicyFromWire(raw)
  }

  public deleteAdminPolicy = async (bucket: string): Promise<any> =>
    this.http.delete(`/bucket-access-policies/${bucket}/admin`)
}
