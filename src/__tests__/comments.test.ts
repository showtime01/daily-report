import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as commentsGET, POST as commentsPOST } from '@/app/api/v1/daily-reports/[id]/comments/route'

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

let userId1: number
let userId3: number
let customerId1: number
let reportId1: number  // reviewed
let reportId2: number  // submitted
let reportId3: number  // draft

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
  await prisma.user.create({
    data: { name: '佐藤 花子', email: 'sato@example.com', passwordDigest: digest, role: 'sales', department: '営業部' },
  })
  const u3 = await prisma.user.create({
    data: { name: '鈴木 部長', email: 'suzuki@example.com', passwordDigest: digest, role: 'manager', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest: digest, role: 'admin', department: '情報システム部' },
  })
  userId1 = u1.id
  userId3 = u3.id

  const c1 = await prisma.customer.create({ data: { companyName: '株式会社アルファ', contactName: '田中 様', industry: '製造業' } })
  customerId1 = c1.id

  const r1 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-01'),
      status: 'reviewed',
      submittedAt: new Date('2026-06-01T09:00:00Z'),
      reviewedAt: new Date('2026-06-01T12:00:00Z'),
      visitRecords: { create: [{ customerId: customerId1, visitType: 'in_person', purpose: '新製品提案' }] },
    },
  })
  const r2 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-02'),
      status: 'submitted',
      submittedAt: new Date('2026-06-02T09:00:00Z'),
      visitRecords: { create: [{ customerId: customerId1, visitType: 'online', purpose: '進捗確認' }] },
    },
  })
  const r3 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-03'),
      status: 'draft',
      visitRecords: { create: [{ customerId: customerId1, visitType: 'phone', purpose: 'フォローアップ' }] },
    },
  })

  await prisma.comment.createMany({
    data: [
      { dailyReportId: r1.id, commenterId: userId3, target: 'problem', body: '価格より価値訴求を優先しましょう' },
      { dailyReportId: r1.id, commenterId: userId3, target: 'plan', body: '期限を明記して送付してください' },
    ],
  })

  reportId1 = r1.id
  reportId2 = r2.id
  reportId3 = r3.id
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
// POST /api/v1/daily-reports/:id/comments
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/daily-reports/:id/comments', () => {
  it('TC-CMT-001 ○ 課題へのコメント投稿', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'problem', body: '対応策を検討してください' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.target).toBe('problem')
    expect(data.commenter_id).toBe(userId3)
    // 後片付け
    await prisma.comment.delete({ where: { id: data.id as number } })
  })

  it('TC-CMT-002 ○ 計画へのコメント投稿', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'plan', body: '期限を確認してください' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.target).toBe('plan')
    await prisma.comment.delete({ where: { id: data.id as number } })
  })

  it('TC-CMT-003 ○ 全般コメントの投稿', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'general', body: 'お疲れ様でした' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.target).toBe('general')
    await prisma.comment.delete({ where: { id: data.id as number } })
  })

  it('TC-CMT-004 ○ 確認済み日報へのコメント投稿', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'general', body: '確認済み日報へのコメント' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId1}/comments`, token, body), params(reportId1))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.id).toBeTruthy()
    await prisma.comment.delete({ where: { id: data.id as number } })
  })

  it('TC-CMT-005 × salesロールがコメントを投稿', async () => {
    const token = await login('yamada@example.com')
    const body = { target: 'problem', body: 'コメント' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(403)
  })

  it('TC-CMT-006 × 下書き日報へのコメント投稿', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'problem', body: 'コメント' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/comments`, token, body), params(reportId3))
    expect(res.status).toBe(403)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('FORBIDDEN')
  })

  it('TC-CMT-007 × コメント本文未入力', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'problem', body: '' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'body')).toBe(true)
  })

  it('TC-CMT-008 × コメント本文1000文字超過', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'problem', body: 'a'.repeat(1001) }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'body')).toBe(true)
  })

  it('TC-CMT-009 × targetが不正値', async () => {
    const token = await login('suzuki@example.com')
    const body = { target: 'invalid', body: 'コメント' }
    const res = await commentsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/comments`, token, body), params(reportId2))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'target')).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────
// GET /api/v1/daily-reports/:id/comments
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/daily-reports/:id/comments', () => {
  it('TC-CMT-010 ○ コメント一覧取得', async () => {
    const token = await login('yamada@example.com')
    const res = await commentsGET(req('GET', `/api/v1/daily-reports/${reportId1}/comments`, token), params(reportId1))
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data.length).toBeGreaterThanOrEqual(2)
  })

  it('TC-CMT-011 ○ targetフィルタで絞り込み', async () => {
    const token = await login('yamada@example.com')
    const res = await commentsGET(req('GET', `/api/v1/daily-reports/${reportId1}/comments?target=problem`, token), params(reportId1))
    expect(res.status).toBe(200)
    const data = await res.json() as Array<{ target: string }>
    expect(data.length).toBeGreaterThan(0)
    expect(data.every((c) => c.target === 'problem')).toBe(true)
  })
})
