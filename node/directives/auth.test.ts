import { authFromCookie, resolveUserToken } from './auth'

const buildCtx = ({
  cookie,
  header,
  perAccountCookie,
  account = 'myaccount',
  isAdmin,
  idUser,
}: {
  cookie?: string
  header?: string
  perAccountCookie?: string
  account?: string
  isAdmin?: boolean
  idUser?: { user: string } | null
} = {}) => {
  const cookies = new Map<string, string>()

  if (cookie) {
    cookies.set('VtexIdclientAutCookie', cookie)
  }

  if (perAccountCookie) {
    cookies.set(`VtexIdclientAutCookie_${account}`, perAccountCookie)
  }

  return {
    clients: {
      sphinx: {
        isAdmin: jest.fn().mockResolvedValue(isAdmin ?? false),
      },
      vtexID: {
        getIdUser: jest
          .fn()
          .mockResolvedValue(
            idUser === undefined ? { user: 'user@example.com' } : idUser
          ),
      },
    },
    cookies: {
      get: (key: string) => cookies.get(key),
    },
    request: {
      header: { vtexidclientautcookie: header },
    },
    vtex: { account },
  }
}

describe('resolveUserToken', () => {
  it('prefers the plain cookie over the header and per-account cookie', () => {
    const ctx = buildCtx({ cookie: 'cookie-token', header: 'header-token' })

    expect(resolveUserToken(ctx)).toBe('cookie-token')
  })

  it('falls back to the request header when the cookie is absent', () => {
    const ctx = buildCtx({ header: 'header-token' })

    expect(resolveUserToken(ctx)).toBe('header-token')
  })

  it('falls back to the per-account cookie (VtexIdclientAutCookie_{account}) when the plain cookie and header are absent', () => {
    const ctx = buildCtx({
      perAccountCookie: 'per-account-token',
      account: 'myaccount',
    })

    expect(resolveUserToken(ctx)).toBe('per-account-token')
  })

  it('prefers the plain cookie and header over the per-account cookie', () => {
    const ctx = buildCtx({
      cookie: 'cookie-token',
      perAccountCookie: 'per-account-token',
    })

    expect(resolveUserToken(ctx)).toBe('cookie-token')

    const ctxHeaderOnly = buildCtx({
      header: 'header-token',
      perAccountCookie: 'per-account-token',
    })

    expect(resolveUserToken(ctxHeaderOnly)).toBe('header-token')
  })

  it('returns undefined when no token source is present', () => {
    const ctx = buildCtx()

    expect(resolveUserToken(ctx)).toBeUndefined()
  })
})

describe('authFromCookie', () => {
  it('rejects when there is no token at all', async () => {
    const ctx = buildCtx()

    const result = await authFromCookie(ctx, 'getFileUrl')

    expect(result).toBe('User must be logged to access this resource')
  })

  it('rejects when the token does not resolve to a user', async () => {
    const ctx = buildCtx({ cookie: 'token', idUser: null })

    const result = await authFromCookie(ctx, 'getFileUrl')

    expect(result).toBe('Could not find user specified by token.')
  })

  it('allows a merely-authenticated (non-admin) user on non-admin operations', async () => {
    const ctx = buildCtx({ cookie: 'token', isAdmin: false })

    const result = await authFromCookie(ctx, 'getFileUrl')

    expect(result).toBe(true)
    expect(ctx.clients.sphinx.isAdmin).not.toHaveBeenCalled()
  })

  it.each([
    'deleteFile',
    'setBucketPolicy',
    'deleteBucketPolicy',
    'listBucketPolicies',
    'getBucketPolicy',
  ])(
    'rejects an authenticated non-admin user on the admin-only operation %s',
    async operationName => {
      const ctx = buildCtx({ cookie: 'token', isAdmin: false })

      const result = await authFromCookie(ctx, operationName)

      expect(result).toBe('User is not admin and can not access resource.')
      expect(ctx.clients.sphinx.isAdmin).toHaveBeenCalledWith(
        'user@example.com'
      )
    }
  )

  it.each([
    'deleteFile',
    'setBucketPolicy',
    'deleteBucketPolicy',
    'listBucketPolicies',
    'getBucketPolicy',
  ])(
    'allows an admin user on the admin-only operation %s',
    async operationName => {
      const ctx = buildCtx({ cookie: 'token', isAdmin: true })

      const result = await authFromCookie(ctx, operationName)

      expect(result).toBe(true)
    }
  )
})
