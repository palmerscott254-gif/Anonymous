export function makeError(code, message, status = 400, details = undefined) {
  return { code, message, status, details };
}

export function toSocketErrorPayload(error, event) {
  return {
    ok: false,
    error: {
      code: error?.code || 'INTERNAL',
      message: error?.message || 'Unexpected error',
      event,
      details: error?.details,
    },
  };
}

export function toHttpErrorPayload(error) {
  return {
    error: {
      code: error?.code || 'INTERNAL',
      message: error?.message || 'Unexpected error',
      details: error?.details,
    },
  };
}
