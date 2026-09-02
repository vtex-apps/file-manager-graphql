// NFR-O11y (PR #34 review, mendescamara): structured logging for every /policies/* operation,
// recording the bucket, the operation and the downstream status, without ever including the
// user token or other personal data. Plain console.log/error is the standard way VTEX IO Node
// runtimes ship structured logs to Splunk -- no extra logger client is provisioned in this app.
type PolicyLogStatus = number | 'success'

interface PolicyLogFields {
  operation: string
  bucket: string | null
  status: PolicyLogStatus
  account?: string
  workspace?: string
}

const extractStatus = (err: any): PolicyLogStatus =>
  err?.response?.status ?? err?.status ?? 'error'

export const logPolicyOperation = (fields: PolicyLogFields): void => {
  const line = JSON.stringify({ type: 'bucket-policy-operation', ...fields })

  if (fields.status === 'success') {
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

    logPolicyOperation({ ...fields, status: 'success' })

    return result
  } catch (err) {
    logPolicyOperation({ ...fields, status: extractStatus(err) })
    throw err
  }
}
