import { getSessionToken, deleteSession, SESSION_COOKIE } from '@/lib/session'
import { errorResponse, clearCookieHeader } from '@/lib/response'

export async function DELETE(request: Request): Promise<Response> {
  const token = getSessionToken(request)
  if (!token) {
    return errorResponse(401, 'UNAUTHORIZED', '認証が必要です')
  }

  await deleteSession(token)

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearCookieHeader(SESSION_COOKIE) },
  })
}
