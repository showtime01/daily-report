import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { POST as visitRecordsPOST } from '@/app/api/v1/daily-reports/[id]/visit-records/route'
import { PUT as visitRecordPUT, DELETE as visitRecordDELETE } from '@/app/api/v1/daily-reports/[id]/visit-records/[vrid]/route'

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

function vrParams(id: number, vrid: number) {
  return { params: Promise.resolve({ id: String(id), vrid: String(vrid) }) }
}

let userId1: number
let userId2: number
let customerId1: number
let customerId2: number
let customerId3: number
let reportId2: number  // submitted
let reportId3: number  // draft
let reportId4: number  // user2 submitted
let visitRecordId3: number  // report3 の訪問記録

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
  await prisma.user.create({
    data: { name: '鈴木 部長', email: 'suzuki@example.com', passwordDigest: digest, role: 'manager', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest: digest, role: 'admin', department: '情報システム部' },
  })
  userId1 = u1.id
  userId2 = u2.id

  const c1 = await prisma.customer.create({ data: { companyName: '株式会社アルファ', contactName: '田中 様', industry: '製造業' } })
  const c2 = await prisma.customer.create({ data: { companyName: '△△商事', contactName: '鈴木 様', industry: '商社' } })
  const c3 = await prisma.customer.create({ data: { companyName: '削除済み顧客', contactName: '—', deletedAt: new Date('2026-01-01') } })
  customerId1 = c1.id
  customerId2 = c2.id
  customerId3 = c3.id

  await prisma.dailyReport.create({
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
    include: { visitRecords: true },
  })

  const r4 = await prisma.dailyReport.create({
    data: {
      userId: userId2,
      reportDate: new Date('2026-06-02'),
      status: 'submitted',
      submittedAt: new Date('2026-06-02T10:00:00Z'),
      visitRecords: { create: [{ customerId: customerId2, visitType: 'in_person', purpose: '提案' }] },
    },
  })

  reportId2 = r2.id
  reportId3 = r3.id
  reportId4 = r4.id
  visitRecordId3 = r3.visitRecords[0].id
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
// POST /api/v1/daily-reports/:id/visit-records
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/daily-reports/:id/visit-records', () => {
  it('TC-VIS-001 ○ 訪問記録の追加', async () => {
    const token = await login('yamada@example.com')
    const body = {
      customer_id: customerId2,
      visit_type: 'online',
      purpose: '提案',
      content: '内容',
      next_action: '資料送付',
      next_visit_date: '2026-06-20',
    }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/visit-records`, token, body), params(reportId3))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.daily_report_id).toBe(reportId3)
    expect(data.customer_name).toBe('△△商事')
    expect(data.visit_type).toBe('online')
    // 後片付け
    await prisma.visitRecord.delete({ where: { id: data.id as number } })
  })

  it('TC-VIS-002 × 提出済み日報への追加', async () => {
    const token = await login('yamada@example.com')
    const body = { customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId2}/visit-records`, token, body), params(reportId2))
    expect(res.status).toBe(403)
  })

  it('TC-VIS-003 × 存在しない顧客IDを指定', async () => {
    const token = await login('yamada@example.com')
    const body = { customer_id: 9999, visit_type: 'in_person', purpose: '目的', content: '内容' }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/visit-records`, token, body), params(reportId3))
    expect(res.status).toBe(404)
  })

  it('TC-VIS-004 × 論理削除済み顧客を指定', async () => {
    const token = await login('yamada@example.com')
    const body = { customer_id: customerId3, visit_type: 'in_person', purpose: '目的', content: '内容' }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/visit-records`, token, body), params(reportId3))
    expect(res.status).toBe(404)
  })

  it('TC-VIS-005 × 訪問種別が不正値', async () => {
    const token = await login('yamada@example.com')
    const body = { customer_id: customerId1, visit_type: 'invalid', purpose: '目的', content: '内容' }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/visit-records`, token, body), params(reportId3))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'visit_type')).toBe(true)
  })

  it('TC-VIS-006 × 次回アクション500文字超過', async () => {
    const token = await login('yamada@example.com')
    const body = { customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容', next_action: 'a'.repeat(501) }
    const res = await visitRecordsPOST(req('POST', `/api/v1/daily-reports/${reportId3}/visit-records`, token, body), params(reportId3))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'next_action')).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────
// PUT /api/v1/daily-reports/:id/visit-records/:vrid
// ──────────────────────────────────────────────────────────

describe('PUT /api/v1/daily-reports/:id/visit-records/:vrid', () => {
  it('TC-VIS-010 ○ 訪問記録の更新', async () => {
    const token = await login('yamada@example.com')
    const body = {
      customer_id: customerId1,
      visit_type: 'in_person',
      purpose: '更新後の目的',
      content: '更新後の内容',
    }
    const res = await visitRecordPUT(
      req('PUT', `/api/v1/daily-reports/${reportId3}/visit-records/${visitRecordId3}`, token, body),
      vrParams(reportId3, visitRecordId3)
    )
    expect(res.status).toBe(200)
    const data = await parseJson(res)
    expect(data.purpose).toBe('更新後の目的')
  })

  it('TC-VIS-011 × 他ユーザーの日報の訪問記録を更新', async () => {
    const token = await login('yamada@example.com')
    // reportId4 は userId2 の日報
    const visitRecordsOfR4 = await prisma.visitRecord.findMany({ where: { dailyReportId: reportId4 } })
    const vrId = visitRecordsOfR4[0].id
    const body = { customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' }
    const res = await visitRecordPUT(
      req('PUT', `/api/v1/daily-reports/${reportId4}/visit-records/${vrId}`, token, body),
      vrParams(reportId4, vrId)
    )
    expect(res.status).toBe(403)
  })
})

// ──────────────────────────────────────────────────────────
// DELETE /api/v1/daily-reports/:id/visit-records/:vrid
// ──────────────────────────────────────────────────────────

describe('DELETE /api/v1/daily-reports/:id/visit-records/:vrid', () => {
  it('TC-VIS-020 ○ 訪問記録の削除（2件以上ある場合）', async () => {
    const token = await login('yamada@example.com')
    // 追加の訪問記録を作成
    const extra = await prisma.visitRecord.create({
      data: { dailyReportId: reportId3, customerId: customerId2, visitType: 'online', purpose: '追加' },
    })
    const res = await visitRecordDELETE(
      req('DELETE', `/api/v1/daily-reports/${reportId3}/visit-records/${extra.id}`, token),
      vrParams(reportId3, extra.id)
    )
    expect(res.status).toBe(204)
    const deleted = await prisma.visitRecord.findUnique({ where: { id: extra.id } })
    expect(deleted).toBeNull()
  })

  it('TC-VIS-021 × 最後の1件を削除しようとする', async () => {
    const token = await login('yamada@example.com')
    // reportId3 には visitRecordId3 の1件のみある状態
    const count = await prisma.visitRecord.count({ where: { dailyReportId: reportId3 } })
    expect(count).toBe(1)
    const res = await visitRecordDELETE(
      req('DELETE', `/api/v1/daily-reports/${reportId3}/visit-records/${visitRecordId3}`, token),
      vrParams(reportId3, visitRecordId3)
    )
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('BUSINESS_RULE_ERROR')
  })

  it('TC-VIS-022 × 提出済み日報の訪問記録を削除', async () => {
    const token = await login('yamada@example.com')
    const visitRecordsOfR2 = await prisma.visitRecord.findMany({ where: { dailyReportId: reportId2 } })
    const vrId = visitRecordsOfR2[0].id
    const res = await visitRecordDELETE(
      req('DELETE', `/api/v1/daily-reports/${reportId2}/visit-records/${vrId}`, token),
      vrParams(reportId2, vrId)
    )
    expect(res.status).toBe(403)
  })
})
