type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BUSINESS_RULE_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'

export function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: { field: string; message: string }[]
): Response {
  const body: Record<string, unknown> = { code, message }
  if (details) body.details = details
  return jsonResponse({ error: body }, status)
}

export function setCookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`
}

export function clearCookieHeader(name: string): string {
  return `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}
