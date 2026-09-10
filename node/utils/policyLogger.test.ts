import { logPolicyOperation, withPolicyLogging } from './policyLogger'

describe('logPolicyOperation', () => {
  let logSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('logs successful operations via console.log with bucket, operation and HTTP 200', () => {
    logPolicyOperation({
      operation: 'getBucketPolicy',
      bucket: 'images',
      status: 200,
      account: 'myaccount',
      workspace: 'master',
    })

    expect(logSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(logSpy.mock.calls[0][0])

    expect(logged).toEqual({
      type: 'bucket-policy-operation',
      operation: 'getBucketPolicy',
      bucket: 'images',
      status: 200,
      account: 'myaccount',
      workspace: 'master',
    })
  })

  it('logs failed operations via console.error with the downstream status', () => {
    logPolicyOperation({
      operation: 'setBucketPolicy',
      bucket: 'images',
      status: 403,
      account: 'myaccount',
      workspace: 'master',
    })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).not.toHaveBeenCalled()

    const logged = JSON.parse(errorSpy.mock.calls[0][0])

    expect(logged.status).toBe(403)
  })

  it('never includes a token or other request headers in the logged payload', () => {
    logPolicyOperation({
      operation: 'getBucketPolicy',
      bucket: 'images',
      status: 200,
    })

    const logged = JSON.parse(logSpy.mock.calls[0][0])

    expect(Object.keys(logged).sort()).toEqual(
      ['bucket', 'operation', 'status', 'type'].sort()
    )
  })
})

describe('withPolicyLogging', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('resolves with the operation result and logs HTTP 200', async () => {
    const result = await withPolicyLogging(
      { operation: 'getBucketPolicy', bucket: 'images' },
      async () => ({ bucket: 'images' })
    )

    expect(result).toEqual({ bucket: 'images' })
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"status":200')
    )
  })

  it('rethrows the original error and logs response.status', async () => {
    const err = { response: { status: 403 } }

    await expect(
      withPolicyLogging(
        { operation: 'setBucketPolicy', bucket: 'images' },
        async () => {
          throw err
        }
      )
    ).rejects.toBe(err)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"status":403')
    )
  })

  it('logs err.statusCode when the VTEX IO client shape has no response.status', async () => {
    const err = { statusCode: 403 }

    await expect(
      withPolicyLogging(
        { operation: 'setBucketPolicy', bucket: 'images' },
        async () => {
          throw err
        }
      )
    ).rejects.toBe(err)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"status":403')
    )
  })

  it('omits status and uses console.error when the error has no HTTP status', async () => {
    const err = new Error('unrecognized wire access level')

    await expect(
      withPolicyLogging(
        { operation: 'getBucketPolicy', bucket: 'images' },
        async () => {
          throw err
        }
      )
    ).rejects.toBe(err)

    expect(console.error).toHaveBeenCalledTimes(1)
    const logged = JSON.parse((console.error as jest.Mock).mock.calls[0][0])
    expect(logged).not.toHaveProperty('status')
    expect(logged.operation).toBe('getBucketPolicy')
  })
})
