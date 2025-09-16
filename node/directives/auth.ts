import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { ALLOW_LIST } from '../config/allowList'

export const authFromCookie = async (ctx: any, operationName: string) => {
  const {
    clients: { sphinx, vtexID },
    vtex: { authToken },
  } = ctx

  const vtexIdToken =
    ctx.cookies.get('VtexIdclientAutCookie') ??
    ctx.cookies.get('VtexIdclientAutCookie_' + ctx.vtex.account) ??
    ctx.request.header.vtexidclientautcookie

  console.log('ctx', ctx)
  console.log('vtexIdToken', vtexIdToken)

  if (!vtexIdToken) {
    return 'User must be logged to access this resource'
  }

  const { user: email } = (await vtexID.getIdUser(vtexIdToken, authToken)) || {
    user: '',
  }

  if (!email) {
    return 'Could not find user specified by token.'
  }

  if (operationName === 'deleteFile') {
    // Only admin users can delete files
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
