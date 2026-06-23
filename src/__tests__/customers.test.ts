import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as listGET, POST as createPOST } from '@/app/api/v1/customers/route'
import { GET as detailGET, PUT as updatePUT, DELETE as deleteDELETE } from '@/app/api/v1/customers/[id]/route'
import { POST as salesPOST } from '@/app/api/v1/customers/[id]/sales/route'
import { DELETE as salesDELETE } from '@/app/api/v1/customers/[id]/sales/[userId]/route'

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

function salesParams(customerId: number, userId: number) {
  return { params: Promise.resolve({ id: String(customerId), userId: String(userId) }) }
}

// ──────────────────────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────────────────────

let userId1: number  // 山田 太郎 (sales)
let userId2: number  // 佐藤 花子 (sales)
let userId3: number  // 鈴木 部長 (manager)
let customerId1: number  // 株式会社アルファ
let customerId2: number  // △△商事
let customerId3: number  // 削除済み顧客

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
  await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest: digest, role: 'admin', department: '情報システム部' },
  })

  userId1 = u1.id
  userId2 = u2.id
  userId3 = u3.id

  const c1 = await prisma.customer.create({
    data: { companyName: '株式会社アルファ', contactName: '田中 様', industry: '製造業' },
  })
  const c2 = await prisma.customer.create({
    data: { companyName: '△△商事', contactName: '鈴木 様', industry: '商社' },
  })
  const c3 = await prisma.customer.create({
    data: { companyName: '削除済み顧客', contactName: '—', deletedAt: new Date('2026-01-01') },
  })

  customerId1 = c1.id
  customerId2 = c2.id
  customerId3 = c3.id

  await prisma.customerSales.create({
    data: { customerId: customerId1, userId: userId1, assignedAt: new Date('2026-04-01') },
  })
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
// TC-CST-001〜003: GET /api/v1/customers
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/customers', () => {
  it('TC-CST-001: admin — 顧客一覧取得（論理削除済みを除外）', async () => {
    const token = await login('admin@example.com')
    const res = await listGET(req('GET', '/api/v1/customers', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    expect(Array.isArray(body)).toBe(true)

    const ids = body.map((c) => c.id)
    expect(ids).toContain(customerId1)
    expect(ids).toContain(customerId2)
    expect(ids).not.toContain(customerId3)

    const c1 = body.find((c) => c.id === customerId1)
    expect(c1).toHaveProperty('sales_count')
  })

  it('TC-CST-002: admin — 企業名フィルタ（部分一致）', async () => {
    const token = await login('admin@example.com')
    const res = await listGET(req('GET', '/api/v1/customers?company_name=%E3%82%A2%E3%83%AB%E3%83%95%E3%82%A1', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    expect(body.length).toBeGreaterThan(0)
    expect(body.every((c) => String(c.company_name).includes('アルファ'))).toBe(true)
  })

  it('TC-CST-003: sales — 訪問記録作成用に顧客一覧取得', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/customers', token))

    expect(res.status).toBe(200)
    const body = await res.json() as Array<Record<string, unknown>>
    const ids = body.map((c) => c.id)
    expect(ids).toContain(customerId1)
    expect(ids).toContain(customerId2)
    expect(ids).not.toContain(customerId3)
  })
})

// ──────────────────────────────────────────────────────────
// TC-CST-010〜015: POST /api/v1/customers
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/customers', () => {
  it('TC-CST-010: 顧客の新規登録（担当営業あり）', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: '株式会社テスト',
        contact_name: 'テスト 様',
        phone: '03-0000-0000',
        email: 'test@customer.com',
        address: '東京都〇〇',
        industry: 'IT',
        sales: [{ user_id: userId1, assigned_at: '2026-06-01' }],
      })
    )

    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.company_name).toBe('株式会社テスト')
    const sales = body.sales as Array<{ user_id: number }>
    expect(sales.some((s) => s.user_id === userId1)).toBe(true)

    await prisma.customerSales.deleteMany({ where: { customerId: body.id as number } })
    await prisma.customer.delete({ where: { id: body.id as number } })
  })

  it('TC-CST-011: 顧客の新規登録（担当営業なし）', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: '株式会社テスト2',
        contact_name: 'テスト2 様',
      })
    )

    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.company_name).toBe('株式会社テスト2')

    await prisma.customer.delete({ where: { id: body.id as number } })
  })

  it('TC-CST-012: 企業名未入力 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: '',
        contact_name: 'テスト 様',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'company_name')).toBe(true)
  })

  it('TC-CST-013: 企業名200文字超過 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: 'あ'.repeat(201),
        contact_name: 'テスト 様',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'company_name')).toBe(true)
  })

  it('TC-CST-014: メールアドレス形式不正 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: '株式会社テスト',
        contact_name: 'テスト 様',
        email: 'not-email',
      })
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    const details = error.details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'email')).toBe(true)
  })

  it('TC-CST-015: salesロールが顧客登録 — 403', async () => {
    const token = await login('yamada@example.com')
    const res = await createPOST(
      req('POST', '/api/v1/customers', token, {
        company_name: '株式会社テスト',
        contact_name: 'テスト 様',
      })
    )

    expect(res.status).toBe(403)
  })
})

// ──────────────────────────────────────────────────────────
// TC-CST-020〜021: DELETE /api/v1/customers/:id
// ──────────────────────────────────────────────────────────

describe('DELETE /api/v1/customers/:id', () => {
  it('TC-CST-020: 顧客の論理削除', async () => {
    const token = await login('admin@example.com')
    const res = await deleteDELETE(
      req('DELETE', `/api/v1/customers/${customerId2}`, token),
      params(customerId2)
    )

    expect(res.status).toBe(204)

    const listRes = await listGET(req('GET', '/api/v1/customers', token))
    const list = await listRes.json() as Array<{ id: number }>
    expect(list.some((c) => c.id === customerId2)).toBe(false)

    const deleted = await prisma.customer.findUnique({ where: { id: customerId2 } })
    expect(deleted?.deletedAt).not.toBeNull()
  })

  it('TC-CST-021: 既に論理削除済みの顧客を削除 — 404', async () => {
    const token = await login('admin@example.com')
    const res = await deleteDELETE(
      req('DELETE', `/api/v1/customers/${customerId3}`, token),
      params(customerId3)
    )

    expect(res.status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────
// TC-SAL-001〜004: POST /api/v1/customers/:id/sales
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/customers/:id/sales', () => {
  it('TC-SAL-001: 担当営業の追加', async () => {
    const token = await login('admin@example.com')
    const res = await salesPOST(
      req('POST', `/api/v1/customers/${customerId1}/sales`, token, {
        user_id: userId2,
        assigned_at: '2026-06-01',
      }),
      params(customerId1)
    )

    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.user_name).toBe('佐藤 花子')
    expect(body.customer_id).toBe(customerId1)
    expect(body.user_id).toBe(userId2)
  })

  it('TC-SAL-002: 同一ユーザーを重複追加 — 409', async () => {
    const token = await login('admin@example.com')
    const res = await salesPOST(
      req('POST', `/api/v1/customers/${customerId1}/sales`, token, {
        user_id: userId1,
        assigned_at: '2026-06-01',
      }),
      params(customerId1)
    )

    expect(res.status).toBe(409)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('CONFLICT')
  })

  it('TC-SAL-003: managerロールを担当営業に追加 — 400', async () => {
    const token = await login('admin@example.com')
    const res = await salesPOST(
      req('POST', `/api/v1/customers/${customerId1}/sales`, token, {
        user_id: userId3,
        assigned_at: '2026-06-01',
      }),
      params(customerId1)
    )

    expect(res.status).toBe(400)
    const body = await parseJson(res)
    const error = body.error as Record<string, unknown>
    expect(error.code).toBe('BUSINESS_RULE_ERROR')
  })

  it('TC-SAL-004: 存在しないユーザーIDを指定 — 404', async () => {
    const token = await login('admin@example.com')
    const res = await salesPOST(
      req('POST', `/api/v1/customers/${customerId1}/sales`, token, {
        user_id: 9999,
        assigned_at: '2026-06-01',
      }),
      params(customerId1)
    )

    expect(res.status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────
// TC-SAL-010〜011: DELETE /api/v1/customers/:id/sales/:userId
// ──────────────────────────────────────────────────────────

describe('DELETE /api/v1/customers/:id/sales/:userId', () => {
  it('TC-SAL-010: 担当営業の削除', async () => {
    const token = await login('admin@example.com')
    const res = await salesDELETE(
      req('DELETE', `/api/v1/customers/${customerId1}/sales/${userId1}`, token),
      salesParams(customerId1, userId1)
    )

    expect(res.status).toBe(204)

    const detail = await detailGET(
      req('GET', `/api/v1/customers/${customerId1}`, token),
      params(customerId1)
    )
    const body = await detail.json() as { sales: Array<{ user_id: number }> }
    expect(body.sales.some((s) => s.user_id === userId1)).toBe(false)
  })

  it('TC-SAL-011: 存在しない担当営業割り当てを削除 — 404', async () => {
    const token = await login('admin@example.com')
    const res = await salesDELETE(
      req('DELETE', `/api/v1/customers/${customerId1}/sales/9999`, token),
      salesParams(customerId1, 9999)
    )

    expect(res.status).toBe(404)
  })
})
