import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import axios from 'axios'
import { ALLOW_LIST } from '../config/allowList'
import { BUCKET_RESTRICTIONS } from '../config/bucketRestrictions'

async function getUserEmail(ctx: any): Promise<string> {
  const { clients: { vtexID }, vtex: { authToken } } = ctx

  const vtexIdToken =
    ctx.cookies.get('VtexIdclientAutCookie') ??
    ctx.request.header.vtexidclientautcookie

  if (!vtexIdToken) throw new Error('User must be logged to access this resource')

  const { user: email } = (await vtexID.getIdUser(vtexIdToken, authToken)) || { user: '' }

  if (!email) throw new Error('Could not find user specified by token.')

  return email
}

async function getUserCanAccessResource(
  authToken: string, account: string, userEmail: string, productCode: string, resourceCode: string): Promise<boolean> {
    
  const url = `http://${account}.vtexcommercestable.com.br/api/license-manager/pvt/accounts/${account}/products/${productCode}/logins/${userEmail}/resources/${resourceCode}/granted`

  const req = await axios.request({
    headers: { 'Authorization': authToken },
    method: 'get',
    url,
  })
  
  return req.data
}

async function checkAuthorizationRestrictions(
  { ctx, operationName, args, email }: { ctx: any, operationName: string, args: any, email: string }) {

  const { account, authToken } = ctx.vtex
  const { sphinx } = ctx.clients

  if (operationName === 'uploadFile' && ALLOW_LIST.includes(account)) return true

  if (operationName === 'uploadFile') {    
    const restriction = BUCKET_RESTRICTIONS.find(
      ({ bucket }) => bucket === args.bucket)

    if (restriction) {
      const canAccess = await getUserCanAccessResource(
        authToken,
        account,
        email,
        restriction.productCode,
        restriction.resourceCode
      )
    
      if (canAccess) return true
      throw new Error(restriction.errorMessage)
    }
  }

  if (operationName === 'deleteFile') {
    // Only admin users can delete files
    const isAdmin = await sphinx.isAdmin(email)

    if (isAdmin) return true
    throw new Error('User is not admin and can not access resource.')
  }

  return true
}

export class Authorization extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root, args, ctx, info) => {
      const operationName = info.fieldName
      const email = await getUserEmail(ctx)
      await checkAuthorizationRestrictions({ ctx, operationName, args, email })
      return resolve(root, args, ctx, info)
    }
  }
}