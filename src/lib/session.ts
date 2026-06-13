import { randomBytes } from 'node:crypto'
import { prisma } from './prisma'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export const SESSION_COOKIE = 'session_id'

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await prisma.session.create({ data: { id: token, userId, expiresAt } })
  return token
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null
  if (session.user.deletedAt) return null

  return session.user
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: token } })
}

export function getSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k.trim() === SESSION_COOKIE) return v.join('=')
  }
  return undefined
}
