jest.mock('@vtex/api', () => {
  return {
    ExternalClient: class {
      constructor(
        public url: string,
        public context: any,
        public options: any
      ) {}
    },
  }
})

import FileManager, {
  toWireAccessLevel,
  fromWireAccessLevel,
} from './FileManager'

describe('FileManager constructor headers', () => {
  const baseContext = {
    account: 'testaccount',
    workspace: 'testworkspace',
    authToken: 'SENTINEL_APP_TOKEN',
  }

  it('includes VtexIdclientAutCookie equal to the token when userToken is passed', () => {
    const userToken = 'resolved-user-token-123'
    const fileManager = new FileManager(
      baseContext as any,
      undefined,
      userToken
    )
    const headers = (fileManager as any).options.headers

    expect(headers).toHaveProperty('VtexIdclientAutCookie', userToken)
  })

  it('omits the VtexIdclientAutCookie key entirely when userToken is undefined', () => {
    const fileManager = new FileManager(
      baseContext as any,
      undefined,
      undefined
    )
    const headers = (fileManager as any).options.headers

    expect(headers).not.toHaveProperty('VtexIdclientAutCookie')
  })

  it('never reads context.authToken for the outbound header', () => {
    const contextWithSentinel = {
      ...baseContext,
      authToken: 'SENTINEL_SHOULD_NOT_BE_USED',
    }
    const fileManager = new FileManager(
      contextWithSentinel as any,
      undefined,
      undefined
    )
    const headers = (fileManager as any).options.headers

    expect(headers).not.toHaveProperty('VtexIdclientAutCookie')
  })
})

describe('access level helpers', () => {
  it('toWireAccessLevel converts all three GraphQL values to wire format', () => {
    expect(toWireAccessLevel('PUBLIC')).toBe('public')
    expect(toWireAccessLevel('AUTHENTICATED')).toBe('authenticated')
    expect(toWireAccessLevel('ACCOUNT_ADMINISTRATOR')).toBe('account-administrator')
  })

  it('fromWireAccessLevel converts all three wire values to GraphQL format', () => {
    expect(fromWireAccessLevel('public')).toBe('PUBLIC')
    expect(fromWireAccessLevel('authenticated')).toBe('AUTHENTICATED')
    expect(fromWireAccessLevel('account-administrator')).toBe('ACCOUNT_ADMINISTRATOR')
  })

  it('round-trips all three values correctly', () => {
    const values = [
      'PUBLIC',
      'AUTHENTICATED',
      'ACCOUNT_ADMINISTRATOR',
    ] as const

    for (const value of values) {
      expect(fromWireAccessLevel(toWireAccessLevel(value))).toBe(value)
    }
  })
})

describe('FileManager policies methods', () => {
  const baseContext = {
    account: 'testaccount',
    workspace: 'testworkspace',
    authToken: 'SENTINEL_APP_TOKEN',
  }

  const makeClient = () => {
    const fileManager = new FileManager(
      baseContext as any,
      undefined,
      'resolved-user-token-123'
    )
    const http = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    }
    ;(fileManager as any).http = http

    return { fileManager, http }
  }

  it('setAdminPolicy sends a POST with wire-format access levels and maps the response', async () => {
    const { fileManager, http } = makeClient()

    http.post.mockResolvedValue({
      readAccess: 'public',
      writeAccess: 'authenticated',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user@example.com',
    })

    const result = await fileManager.setAdminPolicy(
      'mybucket',
      'PUBLIC',
      'AUTHENTICATED'
    )

    expect(http.post).toHaveBeenCalledWith('/bucket-access-policies/mybucket/admin', {
      readAccess: 'public',
      writeAccess: 'authenticated',
    })

    expect(result).toEqual({
      readAccess: 'PUBLIC',
      writeAccess: 'AUTHENTICATED',
      updatedAt: '2024-01-01T00:00:00Z',
      updatedBy: 'user@example.com',
    })
  })

  it('listPolicies maps nested access levels back to GraphQL values and preserves null policies', async () => {
    const { fileManager, http } = makeClient()

    http.get.mockResolvedValue({
      policies: [
        {
          bucket: 'b1',
          effectivePolicy: {
            readAccess: 'public',
            writeAccess: 'authenticated',
          },
          manifestPolicy: null,
          adminPolicy: {
            readAccess: 'account-administrator',
            writeAccess: 'public',
          },
        },
        {
          bucket: 'b2',
          effectivePolicy: {
            readAccess: 'authenticated',
            writeAccess: 'account-administrator',
          },
          manifestPolicy: {
            readAccess: 'public',
            writeAccess: 'public',
          },
          adminPolicy: null,
        },
      ],
      nextMarker: null,
    })

    const result = await fileManager.listPolicies()

    expect(http.get).toHaveBeenCalledWith('/bucket-access-policies')
    expect(result.nextMarker).toBeNull()
    expect(result.policies).toHaveLength(2)
    expect(result.policies[0]).toEqual({
      bucket: 'b1',
      effectivePolicy: {
        readAccess: 'PUBLIC',
        writeAccess: 'AUTHENTICATED',
      },
      manifestPolicy: null,
      adminPolicy: {
        readAccess: 'ACCOUNT_ADMINISTRATOR',
        writeAccess: 'PUBLIC',
      },
    })
    expect(result.policies[1]).toEqual({
      bucket: 'b2',
      effectivePolicy: {
        readAccess: 'AUTHENTICATED',
        writeAccess: 'ACCOUNT_ADMINISTRATOR',
      },
      manifestPolicy: {
        readAccess: 'PUBLIC',
        writeAccess: 'PUBLIC',
      },
      adminPolicy: null,
    })
  })

  it('listPolicies forwards the marker query parameter when provided', async () => {
    const { fileManager, http } = makeClient()

    http.get.mockResolvedValue({
      policies: [],
      nextMarker: null,
    })

    await fileManager.listPolicies('next-page-token')

    expect(http.get).toHaveBeenCalledWith('/bucket-access-policies?marker=next-page-token')
  })

  it('getPolicy maps a single raw response and preserves null policies', async () => {
    const { fileManager, http } = makeClient()

    http.get.mockResolvedValue({
      bucket: 'b1',
      effectivePolicy: {
        readAccess: 'public',
        writeAccess: 'public',
      },
      manifestPolicy: null,
      adminPolicy: null,
    })

    const result = await fileManager.getPolicy('b1')

    expect(http.get).toHaveBeenCalledWith('/bucket-access-policies/b1')
    expect(result).toEqual({
      bucket: 'b1',
      effectivePolicy: {
        readAccess: 'PUBLIC',
        writeAccess: 'PUBLIC',
      },
      manifestPolicy: null,
      adminPolicy: null,
    })
  })

  it('deleteAdminPolicy calls the admin policy delete route', async () => {
    const { fileManager, http } = makeClient()

    http.delete.mockResolvedValue(undefined)

    const result = await fileManager.deleteAdminPolicy('b1')

    expect(http.delete).toHaveBeenCalledWith('/bucket-access-policies/b1/admin')
    expect(result).toBeUndefined()
  })

  it('listPolicies propagates an HTTP rejection unchanged', async () => {
    const { fileManager, http } = makeClient()
    const err = { response: { status: 403 } }

    http.get.mockRejectedValue(err)

    await expect(fileManager.listPolicies()).rejects.toEqual(err)
  })

  it('getPolicy propagates an HTTP rejection unchanged', async () => {
    const { fileManager, http } = makeClient()
    const err = { response: { status: 403 } }

    http.get.mockRejectedValue(err)

    await expect(fileManager.getPolicy('b1')).rejects.toEqual(err)
  })

  it('setAdminPolicy propagates an HTTP rejection unchanged', async () => {
    const { fileManager, http } = makeClient()
    const err = { response: { status: 403 } }

    http.post.mockRejectedValue(err)

    await expect(
      fileManager.setAdminPolicy('b1', 'PUBLIC', 'PUBLIC')
    ).rejects.toEqual(err)
  })

  it('deleteAdminPolicy propagates an HTTP rejection unchanged', async () => {
    const { fileManager, http } = makeClient()
    const err = { response: { status: 403 } }

    http.delete.mockRejectedValue(err)

    await expect(fileManager.deleteAdminPolicy('b1')).rejects.toEqual(err)
  })
})
