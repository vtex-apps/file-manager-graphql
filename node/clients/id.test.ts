import { VtexID } from './id'

const mockPost = jest.fn()

jest.mock('@vtex/api', () => ({
  ExternalClient: class {
    protected http = { post: mockPost }
    protected context: any

    constructor(_baseURL: string, context: any, _options?: any) {
      this.context = context
    }
  },
}))

const mockContext = { account: 'myaccount' } as any

describe('VtexID.getIdUser', () => {
  let client: VtexID

  beforeEach(() => {
    jest.clearAllMocks()
    client = new VtexID(mockContext)
  })

  it('returns user data on success', async () => {
    const mockUser = { user: 'user@example.com', account: 'myaccount' }

    mockPost.mockResolvedValue(mockUser)

    const result = await client.getIdUser('valid-token')

    expect(result).toEqual(mockUser)
    expect(mockPost).toHaveBeenCalledWith(
      'credential/validate',
      { token: 'valid-token' },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': process.env.VTEX_APP_ID,
          'X-VTEX-Proxy-To': 'https://myaccount.vtexcommercestable.com.br',
        },
        metric: 'vtexid-authtoken',
      }
    )
  })

  it('returns null on 401', async () => {
    mockPost.mockRejectedValue({ response: { status: 401 } })

    const result = await client.getIdUser('expired-token')

    expect(result).toBeNull()
  })

  it('rethrows non-401 errors', async () => {
    const serverError = { response: { status: 500 } }

    mockPost.mockRejectedValue(serverError)

    await expect(client.getIdUser('token')).rejects.toEqual(serverError)
  })
})
