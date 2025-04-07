import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export const authFromCookie = async (ctx: any) => {
  const {
    clients: { vtexID },
    vtex: { authToken },
  } = ctx

  
  const vtexIdToken =
    ctx.cookies.get('VtexIdclientAutCookie') ??
    ctx.request.header.vtexidclientautcookie

  if (!vtexIdToken) {
    return 'User must be logged to access this resource'
  }

  const { user: email } = (await vtexID.getIdUser(vtexIdToken, authToken)) || {
    user: '',
  }
  if (!email) {
    return 'Could not find user specified by token.'
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


