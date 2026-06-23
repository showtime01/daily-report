import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { UserCreateSchema, UserQuerySchema } from '@/lib/schemas/users'
import { hashPassword } from '@/lib/password'

function toUserResponse(user: {
  id: number
  name: string
  email: string
  role: string
  department: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const queryResult = UserQuerySchema.safeParse({
    role: url.searchParams.get('role') ?? undefined,
    department: url.searchParams.get('department') ?? undefined,
  })
  if (!queryResult.success) {
    const details = queryResult.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { role, department } = queryResult.data
  const where: Record<string, unknown> = { deletedAt: null }
  if (role) where.role = role
  if (department) where.department = { contains: department }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })

  return jsonResponse(users.map(toUserResponse))
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = UserCreateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { name, email, password, role, department } = result.data

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (existing) {
    return errorResponse(409, 'CONFLICT', 'このメールアドレスは既に使用されています')
  }

  const passwordDigest = hashPassword(password)
  const user = await prisma.user.create({
    data: { name, email, passwordDigest, role, department },
  })

  return jsonResponse(toUserResponse(user), 201)
}
