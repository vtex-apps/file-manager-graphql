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
  // The backend composes the canonical bucket key from {app}/{bucket} (see
  // BucketNamespaceHelper.ComposeBucketKey), so every single-bucket policy route must include
  // an `:app` segment -- otherwise these 404 against /policies/:app/:bucket(/admin), unlike the
  // app-agnostic /policies list route. `app` defaults to this app's own id (VTEX_APP_ID) so
  // existing callers that only pass `bucket` keep operating on their own namespace, but callers
  // that already have the `app` a listBucketPolicies entry belongs to (BucketPolicyView.app) can
  // pass it explicitly to address that exact entry instead of silently drifting onto a different
  // composite key (PR #34 review, mendescamara: getBucketPolicy/setBucketPolicy/deleteBucketPolicy
  // ignored the returned `app` and always targeted runningAppName's own namespace, so acting on a
  // bucket owned by another app either 404'd or created an orphan policy under this app's
  // namespace instead of updating the one the caller saw in the list). Both segments are
  // user-influenced, so both are encoded to keep them single path segments.
  //
  // Fix (Bugbot follow-up on this same commit): `app: string = runningAppName` as a default
  // *parameter* only substitutes for `undefined`, but GraphQL's optional `app: String` argument
  // arrives as `null` (not `undefined`) when a client explicitly sends `app: null` -- the default
  // never kicks in, `app` stays `null`, and `encodeURIComponent(null)` produces the literal path
  // segment "null", silently targeting a bogus `/policies/null/{bucket}` route instead of falling
  // back to this app's own namespace. `??` (nullish coalescing) covers both `undefined` and
  // `null`, unlike a default parameter.
  Policy: (bucket: string, app?: string | null) =>
    `/policies/${encodeURIComponent(app ?? runningAppName)}/${encodeURIComponent(bucket)}`,
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

// Fail closed on unrecognized/missing wire values (PR #34 review, mendescamara): silently
// mapping an unknown value to PUBLIC would mask a contract error/mismatch as a potentially
// insecure representation. Throwing surfaces it loudly instead of ever guessing.
export const fromWireAccessLevel = (level: string): GraphQLAccessLevel => {
  switch (level) {
    case 'public':
      return 'PUBLIC'
    case 'authenticated':
      return 'AUTHENTICATED'
    case 'account-administrator':
      return 'ACCOUNT_ADMINISTRATOR'
    default:
      throw new Error(`Unrecognized wire access level: ${level}`)
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
          // Two distinct identities travel on this hop, and both are required.
          //
          // `Authorization` carries this app's own token and is what *authorizes* the request:
          // every /assets/* route on vtex.file-manager is declared `public: false`, and no
          // end-user role can ever satisfy it -- that app declares no License Manager resource
          // for those routes, so the permission does not exist to be granted to a person. A
          // request presenting only a user token is refused by kube-router with 403 ("Role
          // User:... cannot perform action PUT on resource vrn:vtex.file-manager:...") before
          // ever reaching the service. Dropping this header broke every CMS upload whose caller
          // was not a privileged user.
          //
          // `VtexIdclientAutCookie` carries the end user and is identity *only*: file-manager's
          // UserCredentialService reads it to classify the caller's access level against the
          // bucket policy. It is absent for anonymous callers (see the uploadFile ALLOW_LIST
          // bypass in ../directives/auth), which is why it can never be the hop's credential.
          Authorization: context.authToken,
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
    const raw = await this.http.get(`/policies${qs}`)
    return {
      policies: Array.isArray(raw?.policies)
        ? raw.policies.map(mapPolicyViewFromWire)
        : [],
      nextMarker: raw?.nextMarker ?? null,
    }
  }

  public getPolicy = async (bucket: string, app?: string | null): Promise<any> => {
    const raw = await this.http.get(routes.Policy(bucket, app))
    return mapPolicyViewFromWire(raw)
  }

  public setAdminPolicy = async (
    bucket: string,
    readAccess: string,
    writeAccess: string,
    app?: string | null
  ): Promise<any> => {
    const raw = await this.http.post(`${routes.Policy(bucket, app)}/admin`, {
      readAccess: toWireAccessLevel(readAccess as GraphQLAccessLevel),
      writeAccess: toWireAccessLevel(writeAccess as GraphQLAccessLevel),
    })
    return mapBucketPolicyFromWire(raw)
  }

  public deleteAdminPolicy = async (
    bucket: string,
    app?: string | null
  ): Promise<any> => {
    const raw: any = await this.http.delete(`${routes.Policy(bucket, app)}/admin`)

    // @vtex/api's http.delete drops the JSON body (live: undefined), so GraphQL would
    // fail on DeleteBucketPolicyResult.bucket: String! even after a successful delete.
    if (raw && typeof raw === 'object' && raw.bucket) {
      return raw
    }

    return {
      bucket,
      removedAt:
        raw && typeof raw === 'object' && raw.removedAt
          ? raw.removedAt
          : new Date().toISOString(),
    }
  }
}
