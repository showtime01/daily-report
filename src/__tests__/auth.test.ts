import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { DELETE as logoutDELETE } from '@/app/api/v1/auth/logout/route'
import { GET as meGET } from '@/app/api/v1/auth/me/route'

// ──────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────

function loginRequest(email: string, password: string): Request {
  return new Request('http://localhost/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

function logoutRequest(sessionToken?: string): Request {
  const headers: HeadersInit = {}
  if (sessionToken) headers['Cookie'] = `session_id=${sessionToken}`
  return new Request('http://localhost/api/v1/auth/logout', { method: 'DELETE', headers })
}

function meRequest(sessionToken?: string): Request {
  const headers: HeadersInit = {}
  if (sessionToken) headers['Cookie'] = `session_id=${sessionToken}`
  return new Request('http://localhost/api/v1/auth/me', { method: 'GET', headers })
}

function extractSessionToken(response: Response): string | undefined {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) return undefined
  const match = setCookie.match(/session_id=([^;]+)/)
  return match?.[1]
}

async function parseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

// ──────────────────────────────────────────────────────────
// セットアップ / ティアダウン
// ──────────────────────────────────────────────────────────

beforeAll(async () => {
  // 前回テスト実行の残存データを削除してからシードを投入
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  const passwordDigest = hashPassword('Password1')

  await prisma.user.create({
    data: { name: '山田 太郎', email: 'yamada@example.com', passwordDigest, role: 'sales', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '佐藤 花子', email: 'sato@example.com', passwordDigest, role: 'sales', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '鈴木 部長', email: 'suzuki@example.com', passwordDigest, role: 'manager', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest, role: 'admin', department: '情報システム部' },
  })
  await prisma.user.create({
    data: { name: '削除済み太郎', email: 'deleted@example.com', passwordDigest, role: 'sales', deletedAt: new Date('2026-01-01') },
  })
})

afterEach(async () => {
  await prisma.session.deleteMany()
})

afterAll(async () => {
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

// ──────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('TC-AUTH-001 ○ 正常ログイン（salesロール）', async () => {
    const res = await loginPOST(loginRequest('yamada@example.com', 'Password1'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.role).toBe('sales')
    expect(typeof body.id).toBe('number')
    expect(body.email).toBe('yamada@example.com')
    expect(extractSessionToken(res)).toBeDefined()
  })

  it('TC-AUTH-002 ○ 正常ログイン（managerロール）', async () => {
    const res = await loginPOST(loginRequest('suzuki@example.com', 'Password1'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.role).toBe('manager')
  })

  it('TC-AUTH-003 ○ 正常ログイン（adminロール）', async () => {
    const res = await loginPOST(loginRequest('admin@example.com', 'Password1'))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.role).toBe('admin')
  })

  it('TC-AUTH-004 × パスワード不一致', async () => {
    const res = await loginPOST(loginRequest('yamada@example.com', 'WrongPass1'))
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect((body.error as Record<string, unknown>).code).toBe('UNAUTHORIZED')
  })

  it('TC-AUTH-005 × 存在しないメールアドレス', async () => {
    const res = await loginPOST(loginRequest('notexist@example.com', 'Password1'))
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect((body.error as Record<string, unknown>).code).toBe('UNAUTHORIZED')
  })

  it('TC-AUTH-006 × 論理削除済みアカウント', async () => {
    const res = await loginPOST(loginRequest('deleted@example.com', 'Password1'))
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect((body.error as Record<string, unknown>).code).toBe('UNAUTHORIZED')
  })

  it('TC-AUTH-007 × メールアドレス未入力', async () => {
    const res = await loginPOST(loginRequest('', 'Password1'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details as unknown[]).toContainEqual(
      expect.objectContaining({ field: 'email' })
    )
  })

  it('TC-AUTH-008 × パスワード未入力', async () => {
    const res = await loginPOST(loginRequest('yamada@example.com', ''))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details as unknown[]).toContainEqual(
      expect.objectContaining({ field: 'password' })
    )
  })

  it('TC-AUTH-009 × メールアドレス形式不正', async () => {
    const res = await loginPOST(loginRequest('not-an-email', 'Password1'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details as unknown[]).toContainEqual(
      expect.objectContaining({ field: 'email' })
    )
  })

  it('TC-AUTH-010 × パスワード7文字（8文字未満）', async () => {
    const res = await loginPOST(loginRequest('yamada@example.com', 'Pass123'))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details as unknown[]).toContainEqual(
      expect.objectContaining({ field: 'password' })
    )
  })
})

// ──────────────────────────────────────────────────────────
// DELETE /api/v1/auth/logout
// ──────────────────────────────────────────────────────────

describe('DELETE /api/v1/auth/logout', () => {
  it('TC-AUTH-011 ○ 正常ログアウト', async () => {
    // ログインしてセッションを取得
    const loginRes = await loginPOST(loginRequest('yamada@example.com', 'Password1'))
    const token = extractSessionToken(loginRes)
    expect(token).toBeDefined()

    // ログアウト
    const logoutRes = await logoutDELETE(logoutRequest(token))
    expect(logoutRes.status).toBe(204)

    // 同じセッションIDで /me を呼ぶと 401
    const meRes = await meGET(meRequest(token))
    expect(meRes.status).toBe(401)
  })

  it('TC-AUTH-012 × 未ログイン状態でのログアウト', async () => {
    const res = await logoutDELETE(logoutRequest())
    expect(res.status).toBe(401)
  })
})

// ──────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('TC-AUTH-013 ○ ログインユーザー情報取得', async () => {
    // ログインしてセッションを取得
    const loginRes = await loginPOST(loginRequest('yamada@example.com', 'Password1'))
    const token = extractSessionToken(loginRes)
    expect(token).toBeDefined()

    const res = await meGET(meRequest(token))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(typeof body.id).toBe('number')
    expect(body.name).toBe('山田 太郎')
    expect(body.role).toBe('sales')
  })

  it('TC-AUTH-014 × 未ログイン状態', async () => {
    const res = await meGET(meRequest())
    expect(res.status).toBe(401)
  })
})
