import { getSessionToken, getSessionUser } from '@/lib/session'
import { jsonResponse, errorResponse } from '@/lib/response'

export async function GET(request: Request): Promise<Response> {
  const token = getSessionToken(request)
  const user = await getSessionUser(token)

  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', '認証が必要です')
  }

  return jsonResponse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  })
}
