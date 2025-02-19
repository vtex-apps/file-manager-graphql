import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

const canBypass = (email: string) => {
  return email.includes('@vtex.com')
}

export const authFromCookie = async (ctx: any) => {
  const {
    clients: { sphinx, vtexID },
    vtex: { authToken },
  } = ctx

  const vtexIdToken =
    ctx.cookies.get('VtexIdclientAutCookie') ??
    ctx.request.header.vtexidclientautcookie
  if (!vtexIdToken) {
    return 'VtexIdclientAutCookie not found.'
  }

  const { user: email } = (await vtexID.getIdUser(vtexIdToken, authToken)) || {
    user: '',
  }
  if (!email) {
    return 'Could not find user specified by token.'
  }

  if (canBypass(email)) {
    return true
  }

  const isAdminUser = await sphinx.isAdmin(email)
  if (!isAdminUser) {
    return 'User is not admin and can not access resource.'
  }

  return true
}

export class Authorization extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field
    field.resolve = async (root, args, ctx, info) => {
      const cookieAllowsAccess = await authFromCookie(ctx)

      if (cookieAllowsAccess !== true) {
        throw new Error(cookieAllowsAccess)
      }

      return resolve(root, args, ctx, info)
    }
  }
}


