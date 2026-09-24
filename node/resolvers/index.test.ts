// Regression coverage for the review gap (PR #34, mendescamara): the previous test suite only
// asserted resolveUserToken's return value in isolation, never that it actually reaches the
// outbound request FileManager builds. These tests mock FileManager and check it is constructed
// with the token resolved from each of the three supported sources (plain cookie, header,
// per-account cookie), then that the resolver invokes the corresponding FileManager method.

const getPolicyMock = jest.fn()
const setAdminPolicyMock = jest.fn()
const deleteAdminPolicyMock = jest.fn()
const listPoliciesMock = jest.fn()
const saveFileMock = jest.fn()

jest.mock('../FileManager', () => {
  return jest.fn().mockImplementation((_context, _options, userToken) => ({
    userToken,
    getPolicy: getPolicyMock,
    setAdminPolicy: setAdminPolicyMock,
    deleteAdminPolicy: deleteAdminPolicyMock,
    listPolicies: listPoliciesMock,
    saveFile: saveFileMock,
  }))
})

import { Readable } from 'stream'

import FileManagerMock from '../FileManager'
import { limitStreamSize, MAX_FILE_SIZE_BYTES, resolvers } from './index'

const buildCtx = ({
  cookie,
  header,
  perAccountCookie,
  account = 'myaccount',
}: {
  cookie?: string
  header?: string
  perAccountCookie?: string
  account?: string
} = {}) => {
  const cookies = new Map<string, string>()

  if (cookie) {
    cookies.set('VtexIdclientAutCookie', cookie)
  }

  if (perAccountCookie) {
    cookies.set(`VtexIdclientAutCookie_${account}`, perAccountCookie)
  }

  return {
    vtex: { account, workspace: 'master' },
    cookies: { get: (key: string) => cookies.get(key) },
    request: { header: { vtexidclientautcookie: header } },
  } as any
}

describe('resolvers forward the resolved user token to FileManager for policy operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    getPolicyMock.mockResolvedValue({ bucket: 'images' })
    setAdminPolicyMock.mockResolvedValue({ bucket: 'images' })
    deleteAdminPolicyMock.mockResolvedValue({ bucket: 'images', removedAt: 'now' })
    listPoliciesMock.mockResolvedValue({ policies: [], nextMarker: null })
    saveFileMock.mockResolvedValue('https://acme.vtexassets.com/assets/images/some-file.png')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    ['plain cookie', { cookie: 'cookie-token' }, 'cookie-token'],
    ['request header', { header: 'header-token' }, 'header-token'],
    [
      'per-account cookie',
      { perAccountCookie: 'per-account-token' },
      'per-account-token',
    ],
  ])(
    'getBucketPolicy: constructs FileManager with the token resolved from the %s',
    async (_label, ctxOverrides, expectedToken) => {
      const ctx = buildCtx(ctxOverrides)

      await resolvers.Query.getBucketPolicy(
        undefined,
        { bucket: 'images' },
        ctx
      )

      expect(FileManagerMock).toHaveBeenCalledWith(
        ctx.vtex,
        undefined,
        expectedToken
      )
      expect(getPolicyMock).toHaveBeenCalledWith('images', undefined)
    }
  )

  it('setBucketPolicy forwards the resolved token and logs a success status', async () => {
    const ctx = buildCtx({ cookie: 'cookie-token' })

    await resolvers.Mutation.setBucketPolicy(
      undefined,
      { bucket: 'images', readAccess: 'PUBLIC', writeAccess: 'PUBLIC' },
      ctx
    )

    expect(FileManagerMock).toHaveBeenCalledWith(
      ctx.vtex,
      undefined,
      'cookie-token'
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"operation":"setBucketPolicy"')
    )
  })

  it('deleteBucketPolicy returns the { bucket, removedAt } payload from FileManager unchanged', async () => {
    const ctx = buildCtx({ cookie: 'cookie-token' })

    const result = await resolvers.Mutation.deleteBucketPolicy(
      undefined,
      { bucket: 'images' },
      ctx
    )

    expect(result).toEqual({ bucket: 'images', removedAt: 'now' })
  })

  // Regression coverage (PR #34 review, mendescamara): getBucketPolicy/setBucketPolicy/
  // deleteBucketPolicy used to ignore the `app` a listBucketPolicies entry belongs to and always
  // targeted this app's own namespace, so acting on another app's bucket either 404'd or silently
  // wrote an orphan entry instead of the one the caller saw. These resolvers must forward `app`
  // through to the FileManager client unchanged.
  it.each([
    [
      'getBucketPolicy',
      () =>
        resolvers.Query.getBucketPolicy(
          undefined,
          { bucket: 'assets-builder', app: 'vtex.builder-hub' },
          buildCtx({ cookie: 'cookie-token' })
        ),
      getPolicyMock,
      ['assets-builder', 'vtex.builder-hub'],
    ],
    [
      'deleteBucketPolicy',
      () =>
        resolvers.Mutation.deleteBucketPolicy(
          undefined,
          { bucket: 'assets-builder', app: 'vtex.builder-hub' },
          buildCtx({ cookie: 'cookie-token' })
        ),
      deleteAdminPolicyMock,
      ['assets-builder', 'vtex.builder-hub'],
    ],
  ] as const)(
    '%s forwards the explicit app argument to FileManager',
    async (_label, invoke, mock, expectedArgs) => {
      await invoke()

      expect(mock).toHaveBeenCalledWith(...expectedArgs)
    }
  )

  it('setBucketPolicy forwards the explicit app argument to FileManager', async () => {
    const ctx = buildCtx({ cookie: 'cookie-token' })

    await resolvers.Mutation.setBucketPolicy(
      undefined,
      {
        bucket: 'assets-builder',
        readAccess: 'PUBLIC',
        writeAccess: 'PUBLIC',
        app: 'vtex.builder-hub',
      },
      ctx
    )

    expect(setAdminPolicyMock).toHaveBeenCalledWith(
      'assets-builder',
      'PUBLIC',
      'PUBLIC',
      'vtex.builder-hub'
    )
  })

  it('logs a failure status and rethrows when the downstream call rejects', async () => {
    const err = { response: { status: 403 } }

    setAdminPolicyMock.mockRejectedValue(err)

    const ctx = buildCtx({ cookie: 'cookie-token' })

    await expect(
      resolvers.Mutation.setBucketPolicy(
        undefined,
        { bucket: 'images', readAccess: 'PUBLIC', writeAccess: 'PUBLIC' },
        ctx
      )
    ).rejects.toBe(err)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"status":403')
    )
  })
})

describe('limitStreamSize', () => {
  it('passes through a stream within the limit unchanged', async () => {
    const chunks = [Buffer.from('a'.repeat(10))]
    const result = await limitStreamSize(Readable.from(chunks), 100).toArray()

    expect(Buffer.concat(result).toString()).toBe('a'.repeat(10))
  })

  it('errors out once the stream crosses the limit, without waiting for it to end', async () => {
    const chunks = [Buffer.from('a'.repeat(50)), Buffer.from('b'.repeat(50))]

    await expect(
      limitStreamSize(Readable.from(chunks), 60).toArray()
    ).rejects.toThrow(/exceeds the maximum allowed size/)
  })
})

describe('uploadFile', () => {
  beforeEach(() => {
    saveFileMock.mockReset()
  })

  const buildLoadedFile = (content: string, mimetype = 'image/png') => ({
    filename: 'photo.png',
    mimetype,
    encoding: '7bit',
    createReadStream: () => Readable.from([Buffer.from(content)]),
  })

  // saveFile is a network call in production, so its real implementation reads the stream it's
  // given (that's how the body reaches file-manager). The mock has to do the same to observe the
  // size-limit Transform erroring mid-stream, instead of just recording that it was called.
  const drainStreamThenResolve = async (_file: unknown, stream: Readable) => {
    await stream.toArray()
    return 'https://acme.vtexassets.com/assets/images/some-file.png'
  }

  it('saves a file within the size limit', async () => {
    saveFileMock.mockImplementation(drainStreamThenResolve)
    const loadedFile = buildLoadedFile('small file content')
    const ctx = buildCtx({ cookie: 'cookie-token' })

    const result = await resolvers.Mutation.uploadFile(
      undefined,
      { file: Promise.resolve(loadedFile), bucket: 'images' },
      ctx
    )

    expect(result.fileUrl).toBe(
      'https://acme.vtexassets.com/assets/images/some-file.png'
    )
  })

  it('rejects a file over MAX_FILE_SIZE_BYTES instead of forwarding the whole payload', async () => {
    saveFileMock.mockImplementation(drainStreamThenResolve)
    const oversizedContent = 'a'.repeat(MAX_FILE_SIZE_BYTES + 1)
    const loadedFile = buildLoadedFile(oversizedContent)
    const ctx = buildCtx({ cookie: 'cookie-token' })

    await expect(
      resolvers.Mutation.uploadFile(
        undefined,
        { file: Promise.resolve(loadedFile), bucket: 'images' },
        ctx
      )
    ).rejects.toThrow(/exceeds the maximum allowed size/)
  })

  it('rejects an invalid file format before touching the stream', async () => {
    const loadedFile = buildLoadedFile('irrelevant', 'application/x-msdownload')
    const badFile = { ...loadedFile, filename: 'virus.exe' }
    const ctx = buildCtx({ cookie: 'cookie-token' })

    await expect(
      resolvers.Mutation.uploadFile(
        undefined,
        { file: Promise.resolve(badFile), bucket: 'images' },
        ctx
      )
    ).rejects.toThrow('Invalid file format')

    expect(saveFileMock).not.toHaveBeenCalled()
  })
})
