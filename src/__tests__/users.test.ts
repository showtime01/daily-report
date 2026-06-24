import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as listGET, POST as createPOST } from '@/app/api/v1/users/route'
import { PUT as updatePUT, DELETE as deleteDELETE } from '@/app/api/v1/users/[id]/route'

// ──────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────

async function parseJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>
}

function extractSessionToken(res: Response): string | undefined {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return undefined
  return setCookie.match(/session_id=([^;]+)/)?.[1]
}

async function login(email: string, password = 'Password1'): Promise<string> {
  const res = await loginPOST(
    new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  )
  const token = extractSessionToken(res)
  if (!token) throw new Error(`Login failed for ${email}`)
  return token
}

function req(method: string, url: string, token?: string, body?: unknown): Request {
  const headers: HeadersInit = {}
  if (token) headers['Cookie'] = `session_id=${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

// ──────────────────────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────────────────────

let userId1: number  // 山田 太郎 (sales)
let userId2: number  // 佐藤 花子 (sales)
let userId3: number  // 鈴木 部長 (manager)
let userId4: number  // 管理者 (admin)
let userId5: number  // 削除済み太郎 (sales, deleted)

// ──────────────────────────────────────────────────────────
// セットアップ / ティアダウン
// ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.comment.deleteMany()
  await prisma.visitRecord.deleteMany()
  await prisma.dailyReport.deleteMany()
  await prisma.customerSales.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  const digest = hashPassword('Password1')

  const u1 = await prisma.user.create({
    data: { name: '山田 太郎', email: 'yamada@example.com', passwordDigest: digest, role: 'sales', department: '営業部' },
  })
  const u2 = await prisma.user.create({
    data: { name: '佐藤 花子', email: 'sato@example.com', passwordDigest: digest, role: 'sales', department: '営業部' },
  })
  const u3 = await prisma.user.create({
    data: { name: '鈴木 部長', email: 'suzuki@example.com', passwordDigest: digest, role: 'manager', department: '営業部' },
  })
  const u4 = await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest: digest, role: 'admin', department: '情報システム部' },
  })
  const u5 = await prisma.user.create({
    data: { name: '削除済み太郎', email: 'deleted@example.com', passwordDigest: digest, role: 'sales', deletedAt: new Date('2026-01-01') },
  })

  userId1 = u1.id
  userId2 = u2.id
  userId3 = u3.id
  userId4 = u4.id
  userId5 = u5.id
})

afterEach(async () => {
  await prisma.session.deleteMany()
})

afterAll(async () => {
  await prisma.comment.deleteMany()
  await prisma.visitRecord.deleteMany()
  await prisma.dailyReport.deleteMany()
  await prisma.customerSales.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

// ──────────────────────────────────────────────────────────
// TC-USR-001〜005: GET /api/v1/users
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('TC-USR-001: admin — ユーザー一覧取得（論理削除済みを除外）', async () => {
    const token = await login('admin@example.com')
    const res = await listGET(req('GET', '/api/v1/users', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    expect(Array.isArray(body)).toBe(true)

    const ids = body.map((u) => u.id)
    expect(ids).toContain(userId1)
    expect(ids).toContain(userId2)
    expect(ids).toContain(userId3)
    expect(ids).toContain(userId4)
    expect(ids).not.toContain(userId5)

    body.forEach((u) => {
      expect(u).not.toHaveProperty('password_digest')
      expect(u).not.toHaveProperty('passwordDigest')
    })
  })

  it('TC-USR-002: admin — ロールフィルタ（sales）', async () => {
    const token = await login('admin@example.com')
    const res = await listGET(req('GET', '/api/v1/users?role=sales', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    expect(body.every((u) => u.role === 'sales')).toBe(true)
    const ids = body.map((u) => u.id)
    expect(ids).toContain(userId1)
    expect(ids).toContain(userId2)
    expect(ids).not.toContain(userId3)
    expect(ids).not.toContain(userId4)
  })

  it('TC-USR-003: admin — 部署フィルタ（部分一致）', async () => {
    const token = await login('admin@example.com')
    const res = await listGET(req('GET', '/api/v1/users?department=%E5%96%B6%E6%A5%AD', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    expect(body.every((u) => String(u.department ?? '').includes('営業'))).toBe(true)
    const ids = body.map((u) => u.id)
    expect(ids).toContain(userId1)
    expect(ids).not.toContain(userId4)
  })

  it('TC-USR-004: salesロールがアクセス — 403', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/users', token))
    expect(res.status).toBe(403)
  })

  it('TC-USR-005: managerロールがアクセス — 403', async () => {
    const token = await login('suzuki@example.com')
    const res = await listGET(req('GET', '/api/v1/users', token))
    expect(res.status).toBe(403)
  })
})

// ──────────────────────────────────────────────────────────
// TC-USR-010〜017: POST /api/v1/users
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/users', () => {
  it('TC-USR-010: ユーザー新規登録', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: '新規 太郎',
        email: 'new@example.com',
        password: 'Password1',
        role: 'sales',
        department: '第2営業部',
      })
    )

    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.name).toBe('新規 太郎')
    expect(body.email).toBe('new@example.com')
    expect(body.role).toBe('sales')
    expect(body).not.toHaveProperty('password_digest')
    expect(body).not.toHaveProperty('passwordDigest')

    await prisma.user.deleteMany({ where: { email: 'new@example.com' } })
  })

  it('TC-USR-011: 氏名未入力 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: '',
        email: 'test@example.com',
        password: 'Password1',
        role: 'sales',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'name')).toBe(true)
  })

  it('TC-USR-012: 氏名100文字超過 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: 'あ'.repeat(101),
        email: 'test@example.com',
        password: 'Password1',
        role: 'sales',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'name')).toBe(true)
  })

  it('TC-USR-013: メールアドレス重複 — 409', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: '山田 太郎',
        email: 'yamada@example.com',
        password: 'Password1',
        role: 'sales',
      })
    )

    expect(res.status).toBe(409)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('CONFLICT')
  })

  it('TC-USR-014: パスワード未入力（新規登録時）— 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: 'テスト 太郎',
        email: 'test2@example.com',
        password: '',
        role: 'sales',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'password')).toBe(true)
  })

  it('TC-USR-015: パスワード複雑さ不足（数字なし）— 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: 'テスト 太郎',
        email: 'test3@example.com',
        password: 'Passwordonly',
        role: 'sales',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'password')).toBe(true)
  })

  it('TC-USR-016: パスワード複雑さ不足（英大文字なし）— 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: 'テスト 太郎',
        email: 'test4@example.com',
        password: 'password1',
        role: 'sales',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'password')).toBe(true)
  })

  it('TC-USR-017: ロール未選択 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/users', token, {
        name: 'テスト 太郎',
        email: 'test5@example.com',
        password: 'Password1',
        role: '',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'role')).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────
// TC-USR-020〜022: PUT /api/v1/users/:id
// ──────────────────────────────────────────────────────────

describe('PUT /api/v1/users/:id', () => {
  it('TC-USR-020: ユーザー情報更新（パスワード変更あり）', async () => {
    const token = await login('admin@example.com')
    const res = await updatePUT(
      req('PUT', `/api/v1/users/${userId1}`, token, {
        name: '山田 一郎',
        email: 'yamada@example.com',
        password: 'NewPass1',
        role: 'sales',
        department: '営業部',
      }),
      params(userId1)
    )

    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.name).toBe('山田 一郎')

    const loginRes = await loginPOST(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'yamada@example.com', password: 'NewPass1' }),
      })
    )
    expect(loginRes.status).toBe(200)

    await updatePUT(
      req('PUT', `/api/v1/users/${userId1}`, token, {
        name: '山田 太郎',
        email: 'yamada@example.com',
        password: 'Password1',
        role: 'sales',
        department: '営業部',
      }),
      params(userId1)
    )
  })

  it('TC-USR-021: ユーザー情報更新（パスワード変更なし）', async () => {
    const token = await login('admin@example.com')
    const res = await updatePUT(
      req('PUT', `/api/v1/users/${userId1}`, token, {
        name: '山田 太郎',
        email: 'yamada@example.com',
        role: 'sales',
        department: '営業部',
      }),
      params(userId1)
    )

    expect(res.status).toBe(200)

    const loginRes = await loginPOST(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'yamada@example.com', password: 'Password1' }),
      })
    )
    expect(loginRes.status).toBe(200)
  })

  it('TC-USR-022: 論理削除済みユーザーの更新 — 404', async () => {
    const token = await login('admin@example.com')
    const res = await updatePUT(
      req('PUT', `/api/v1/users/${userId5}`, token, {
        name: '削除済み太郎',
        email: 'deleted@example.com',
        role: 'sales',
      }),
      params(userId5)
    )

    expect(res.status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────
// TC-USR-030〜032: DELETE /api/v1/users/:id
// ──────────────────────────────────────────────────────────

describe('DELETE /api/v1/users/:id', () => {
  it('TC-USR-030: ユーザーの論理削除', async () => {
    const token = await login('admin@example.com')
    const res = await deleteDELETE(
      req('DELETE', `/api/v1/users/${userId2}`, token),
      params(userId2)
    )

    expect(res.status).toBe(204)

    const listRes = await listGET(req('GET', '/api/v1/users', token))
    const list = await listRes.json() as Array<{ id: number }>
    expect(list.some((u) => u.id === userId2)).toBe(false)

    const deletedUser = await prisma.user.findUnique({ where: { id: userId2 } })
    expect(deletedUser?.deletedAt).not.toBeNull()
  })

  it('TC-USR-031: 既に論理削除済みのユーザーを削除 — 404', async () => {
    const token = await login('admin@example.com')
    const res = await deleteDELETE(
      req('DELETE', `/api/v1/users/${userId5}`, token),
      params(userId5)
    )

    expect(res.status).toBe(404)
  })

  it('TC-USR-032: 論理削除済みユーザーはログイン不可', async () => {
    const loginRes = await loginPOST(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sato@example.com', password: 'Password1' }),
      })
    )
    expect(loginRes.status).toBe(401)
  })
})
