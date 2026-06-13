import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, digest: string): boolean {
  const [salt, storedHash] = digest.split(':')
  if (!salt || !storedHash) return false
  const expected = Buffer.from(storedHash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return timingSafeEqual(actual, expected)
}
