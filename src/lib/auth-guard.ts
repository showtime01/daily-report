import { getSessionUser, getSessionToken } from './session'
import { errorResponse } from './response'

type Role = 'sales' | 'manager' | 'admin'

export type SessionUser = {
  id: number
  name: string
  email: string
  role: string
  department: string | null
  passwordDigest: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export async function requireAuth(request: Request): Promise<SessionUser | Response> {
  const token = getSessionToken(request)
  const user = await getSessionUser(token)
  if (!user) return errorResponse(401, 'UNAUTHORIZED', '認証が必要です')
  return user
}

export async function requireRole(
  request: Request,
  ...roles: Role[]
): Promise<SessionUser | Response> {
  const result = await requireAuth(request)
  if (result instanceof Response) return result
  if (!roles.includes(result.role as Role)) {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }
  return result
}
