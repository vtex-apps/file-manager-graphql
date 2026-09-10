// NFR-O11y: structured logging for every /policies/* operation, recording
// bucket, operation and the HTTP status returned by file-manager, without
// ever including the user token or other personal data. `status` is always
// a numeric HTTP code (200 on success) so Splunk filters stay homogeneous.
// Plain console.log/error is how VTEX IO Node runtimes ship structured
// logs to Splunk -- no extra logger client is provisioned in this app.

interface PolicyLogFields {
  operation: string
  bucket: string | null
  status?: number
  account?: string
  workspace?: string
}

const extractStatus = (err: any): number | undefined => {
  const status = err?.response?.status ?? err?.statusCode ?? err?.status
  return typeof status === 'number' ? status : undefined
}

export const logPolicyOperation = (fields: PolicyLogFields): void => {
  const line = JSON.stringify({ type: 'bucket-policy-operation', ...fields })

  if (typeof fields.status === 'number' && fields.status < 400) {
    console.log(line)
  } else {
    console.error(line)
  }
}

export const withPolicyLogging = async <T>(
  fields: Omit<PolicyLogFields, 'status'>,
  operationFn: () => Promise<T>
): Promise<T> => {
  try {
    const result = await operationFn()

    logPolicyOperation({ ...fields, status: 200 })

    return result
  } catch (err) {
    const status = extractStatus(err)
    logPolicyOperation(
      status === undefined ? fields : { ...fields, status }
    )
    throw err
  }
}
