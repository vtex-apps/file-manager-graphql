import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { ALLOW_LIST } from '../config/allowList'

export const resolveUserToken = (ctx: any): string | undefined => {
  const token =
    ctx.cookies.get('VtexIdclientAutCookie') ??
    ctx.request.header.vtexidclientautcookie ??
    ctx.cookies.get(`VtexIdclientAutCookie_${ctx.vtex.account}`)

  return token || undefined
}

// Operations that manage bucket access policies are as sensitive as deleteFile:
// gating them here on isAdmin avoids an unauthorized request ever reaching
// file-manager (which would reject it anyway via License Manager, but only
// after the round-trip).
const ADMIN_ONLY_OPERATIONS = [
  'deleteFile',
  'setBucketPolicy',
  'deleteBucketPolicy',
  'listBucketPolicies',
  'getBucketPolicy',
]

export const authFromCookie = async (ctx: any, operationName: string) => {
  const {
    clients: { sphinx, vtexID },
  } = ctx

  const vtexIdToken = resolveUserToken(ctx)

  if (!vtexIdToken) {
    return 'User must be logged to access this resource'
  }

  const { user: email } = (await vtexID.getIdUser(vtexIdToken)) || {
    user: '',
  }

  if (!email) {
    return 'Could not find user specified by token.'
  }

  if (ADMIN_ONLY_OPERATIONS.includes(operationName)) {
    const isAdminUser = await sphinx.isAdmin(email)

    if (!isAdminUser) {
      return 'User is not admin and can not access resource.'
    }
  }

  return true
}

export class Authorization extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    // eslint-disable-next-line max-params
    field.resolve = async (root, args, ctx, info) => {
      const operationName = info.fieldName
      let isAllowed = false

      if (operationName === 'uploadFile') {
        const isInAllowList = ALLOW_LIST.includes(ctx.vtex.account)

        if (isInAllowList) {
          isAllowed = true
        }
      }

      if (!isAllowed) {
        const cookieAllowsAccess = await authFromCookie(ctx, operationName)

        if (cookieAllowsAccess !== true) {
          throw new Error(cookieAllowsAccess)
        }
      }

      return resolve(root, args, ctx, info)
    }
  }
}
