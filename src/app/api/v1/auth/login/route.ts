import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { createSession, SESSION_COOKIE } from '@/lib/session'
import { jsonResponse, errorResponse, setCookieHeader } from '@/lib/response'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('正しいメールアドレス形式で入力してください'),
  password: z
    .string()
    .min(1, 'パスワードを入力してください')
    .min(8, 'パスワードは8文字以上で入力してください'),
})

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = loginSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { email, password } = result.data

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  })

  if (!user || !verifyPassword(password, user.passwordDigest)) {
    return errorResponse(401, 'UNAUTHORIZED', 'メールアドレスまたはパスワードが正しくありません')
  }

  const token = await createSession(user.id)

  return jsonResponse(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
    200,
    { 'Set-Cookie': setCookieHeader(SESSION_COOKIE, token, 7 * 24 * 60 * 60) }
  )
}
