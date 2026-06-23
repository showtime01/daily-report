import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { UserUpdateSchema } from '@/lib/schemas/users'
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

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const userId = Number(id)

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) return errorResponse(404, 'NOT_FOUND', 'ユーザーが存在しません')

  return jsonResponse(toUserResponse(user))
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const userId = Number(id)

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) return errorResponse(404, 'NOT_FOUND', 'ユーザーが存在しません')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = UserUpdateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { name, email, password, role, department } = result.data

  if (email !== user.email) {
    const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } })
    if (existing) {
      return errorResponse(409, 'CONFLICT', 'このメールアドレスは既に使用されています')
    }
  }

  const data: Record<string, unknown> = { name, email, role, department }
  if (password) {
    data.passwordDigest = hashPassword(password)
  }

  const updated = await prisma.user.update({ where: { id: userId }, data })

  return jsonResponse(toUserResponse(updated))
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const userId = Number(id)

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) return errorResponse(404, 'NOT_FOUND', 'ユーザーが存在しません')

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })

  return new Response(null, { status: 204 })
}
