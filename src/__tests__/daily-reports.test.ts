import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as listGET, POST as reportPOST } from '@/app/api/v1/daily-reports/route'
import { GET as detailGET, PUT as reportPUT } from '@/app/api/v1/daily-reports/[id]/route'
import { POST as submitPOST } from '@/app/api/v1/daily-reports/[id]/submit/route'
import { POST as reviewPOST } from '@/app/api/v1/daily-reports/[id]/review/route'

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

function req(
  method: string,
  url: string,
  token?: string,
  body?: unknown
): Request {
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
// テストデータ（シードID を変数で管理）
// ──────────────────────────────────────────────────────────

let userId1: number   // 山田 太郎 (sales)
let userId2: number   // 佐藤 花子 (sales)
let userId3: number   // 鈴木 部長 (manager)
let customerId1: number  // 株式会社アルファ
let customerId2: number  // △△商事
let customerId3: number  // 削除済み顧客
let reportId1: number   // user1, reviewed, 2026-06-01
let reportId2: number   // user1, submitted, 2026-06-02
let reportId3: number   // user1, draft,     2026-06-03
let reportId4: number   // user2, submitted, 2026-06-02

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

  const c1 = await prisma.customer.create({ data: { companyName: '株式会社アルファ', contactName: '田中 様', industry: '製造業' } })
  const c2 = await prisma.customer.create({ data: { companyName: '△△商事', contactName: '鈴木 様', industry: '商社' } })
  const c3 = await prisma.customer.create({ data: { companyName: '削除済み顧客', contactName: '—', deletedAt: new Date('2026-01-01') } })
  customerId1 = c1.id
  customerId2 = c2.id
  customerId3 = c3.id

  const r1 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-01'),
      status: 'reviewed',
      submittedAt: new Date('2026-06-01T09:00:00Z'),
      reviewedAt: new Date('2026-06-01T12:00:00Z'),
      visitRecords: {
        create: [{ customerId: customerId1, visitType: 'in_person', purpose: '新製品提案' }],
      },
    },
  })
  const r2 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-02'),
      status: 'submitted',
      submittedAt: new Date('2026-06-02T09:00:00Z'),
      visitRecords: {
        create: [{ customerId: customerId1, visitType: 'online', purpose: '進捗確認' }],
      },
    },
  })
  const r3 = await prisma.dailyReport.create({
    data: {
      userId: userId1,
      reportDate: new Date('2026-06-03'),
      status: 'draft',
      visitRecords: {
        create: [{ customerId: customerId1, visitType: 'phone', purpose: 'フォローアップ' }],
      },
    },
  })
  const r4 = await prisma.dailyReport.create({
    data: {
      userId: userId2,
      reportDate: new Date('2026-06-02'),
      status: 'submitted',
      submittedAt: new Date('2026-06-02T10:00:00Z'),
      visitRecords: {
        create: [{ customerId: customerId2, visitType: 'in_person', purpose: '提案' }],
      },
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
  reportId4 = r4.id
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
// GET /api/v1/daily-reports
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/daily-reports', () => {
  it('TC-RPT-001 ○ sales：自分の日報一覧取得', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/daily-reports', token))
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    const ids = (body as Array<{ id: number }>).map((r) => r.id)
    expect(ids).toContain(reportId1)
    expect(ids).toContain(reportId2)
    expect(ids).toContain(reportId3)
    expect(ids).not.toContain(reportId4)
  })

  it('TC-RPT-002 ○ sales：ステータスフィルタ（draft）', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/daily-reports?status=draft', token))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ id: number; status: string }>
    expect(body.every((r) => r.status === 'draft')).toBe(true)
    expect(body.some((r) => r.id === reportId3)).toBe(true)
    expect(body.every((r) => r.id !== reportId1 && r.id !== reportId2)).toBe(true)
  })

  it('TC-RPT-003 ○ sales：期間フィルタ', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/daily-reports?date_from=2026-06-01&date_to=2026-06-02', token))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ id: number }>
    const ids = body.map((r) => r.id)
    expect(ids).toContain(reportId1)
    expect(ids).toContain(reportId2)
    expect(ids).not.toContain(reportId3)
  })

  it('TC-RPT-004 × sales：開始日 > 終了日', async () => {
    const token = await login('yamada@example.com')
    const res = await listGET(req('GET', '/api/v1/daily-reports?date_from=2026-06-03&date_to=2026-06-01', token))
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    expect((body.error as Record<string, unknown>).code).toBe('VALIDATION_ERROR')
  })

  it('TC-RPT-005 ○ manager：全ユーザーの日報一覧取得', async () => {
    const token = await login('suzuki@example.com')
    const res = await listGET(req('GET', '/api/v1/daily-reports', token))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ id: number }>
    const ids = body.map((r) => r.id)
    expect(ids).toContain(reportId1)
    expect(ids).toContain(reportId2)
    expect(ids).toContain(reportId3)
    expect(ids).toContain(reportId4)
  })

  it('TC-RPT-006 ○ manager：担当者フィルタ', async () => {
    const token = await login('suzuki@example.com')
    const res = await listGET(req('GET', `/api/v1/daily-reports?user_id=${userId2}`, token))
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ id: number }>
    expect(body.every((r) => r.id === reportId4)).toBe(true)
  })

  it('TC-RPT-007 × 未ログイン状態', async () => {
    const res = await listGET(req('GET', '/api/v1/daily-reports'))
    expect(res.status).toBe(401)
  })
})

// ──────────────────────────────────────────────────────────
// POST /api/v1/daily-reports
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/daily-reports', () => {
  const draftBody = {
    report_date: '2026-06-10',
    status: 'draft',
    problem: '課題テスト',
    plan: '計画テスト',
    visit_records: [
      { customer_id: 0, visit_type: 'in_person', purpose: '目的', content: '内容' },
    ],
  }

  it('TC-RPT-010 ○ 下書き保存（訪問記録1件）', async () => {
    const token = await login('yamada@example.com')
    const body = { ...draftBody, visit_records: [{ ...draftBody.visit_records[0], customer_id: customerId1 }] }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.status).toBe('draft')
    expect(typeof data.id).toBe('number')
    // 後片付け
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: data.id as number } })
    await prisma.dailyReport.delete({ where: { id: data.id as number } })
  })

  it('TC-RPT-011 ○ 提出（必須項目すべて入力済み）', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-11',
      status: 'submitted',
      problem: '課題',
      plan: '計画',
      visit_records: [
        { customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' },
      ],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(201)
    const data = await parseJson(res)
    expect(data.status).toBe('submitted')
    expect(data.submitted_at).not.toBeNull()
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: data.id as number } })
    await prisma.dailyReport.delete({ where: { id: data.id as number } })
  })

  it('TC-RPT-012 × 提出：訪問記録0件', async () => {
    const token = await login('yamada@example.com')
    const body = { report_date: '2026-06-12', status: 'submitted', visit_records: [] }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('BUSINESS_RULE_ERROR')
  })

  it('TC-RPT-013 × 提出：訪問記録の顧客未選択', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      visit_records: [{ visit_type: 'in_person', purpose: '目的', content: '内容' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'customer_id')).toBe(true)
  })

  it('TC-RPT-014 × 提出：訪問目的未入力', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '', content: '内容' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'purpose')).toBe(true)
  })

  it('TC-RPT-015 × 提出：訪問目的200文字超過', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: 'a'.repeat(201), content: '内容' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'purpose')).toBe(true)
  })

  it('TC-RPT-016 × 提出：訪問内容1000文字超過', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: 'a'.repeat(1001) }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'content')).toBe(true)
  })

  it('TC-RPT-017 × 提出：次回訪問予定日が過去日', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容', next_visit_date: '2026-01-01' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'next_visit_date')).toBe(true)
  })

  it('TC-RPT-018 × 提出：課題2000文字超過', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'submitted',
      problem: 'a'.repeat(2001),
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    const details = (data.error as Record<string, unknown>).details as Array<{ field: string }>
    expect(details.some((d) => d.field === 'problem')).toBe(true)
  })

  it('TC-RPT-019 × 同一ユーザー・同一日付の日報が既に存在', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-01',
      status: 'draft',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(409)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('CONFLICT')
  })

  it('TC-RPT-020 × 論理削除済み顧客を選択', async () => {
    const token = await login('yamada@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'draft',
      visit_records: [{ customer_id: customerId3, visit_type: 'in_person' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(404)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('NOT_FOUND')
  })

  it('TC-RPT-021 × managerロールが日報を作成しようとする', async () => {
    const token = await login('suzuki@example.com')
    const body = {
      report_date: '2026-06-12',
      status: 'draft',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person' }],
    }
    const res = await reportPOST(req('POST', '/api/v1/daily-reports', token, body))
    expect(res.status).toBe(403)
  })
})

// ──────────────────────────────────────────────────────────
// GET /api/v1/daily-reports/:id
// ──────────────────────────────────────────────────────────

describe('GET /api/v1/daily-reports/:id', () => {
  it('TC-RPT-030 ○ sales：自分の日報詳細取得（訪問記録・コメント含む）', async () => {
    const token = await login('yamada@example.com')
    const res = await detailGET(req('GET', `/api/v1/daily-reports/${reportId1}`, token), params(reportId1))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(Array.isArray(body.visit_records)).toBe(true)
    expect(Array.isArray(body.comments)).toBe(true)
    expect((body.comments as unknown[]).length).toBeGreaterThanOrEqual(2)
  })

  it('TC-RPT-031 × sales：他ユーザーの日報へアクセス', async () => {
    const token = await login('yamada@example.com')
    const res = await detailGET(req('GET', `/api/v1/daily-reports/${reportId4}`, token), params(reportId4))
    expect(res.status).toBe(403)
  })

  it('TC-RPT-032 ○ manager：任意のユーザーの日報詳細取得', async () => {
    const token = await login('suzuki@example.com')
    const res = await detailGET(req('GET', `/api/v1/daily-reports/${reportId4}`, token), params(reportId4))
    expect(res.status).toBe(200)
  })

  it('TC-RPT-033 × 存在しない日報ID', async () => {
    const token = await login('yamada@example.com')
    const res = await detailGET(req('GET', '/api/v1/daily-reports/9999', token), params(9999))
    expect(res.status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────
// PUT /api/v1/daily-reports/:id
// ──────────────────────────────────────────────────────────

describe('PUT /api/v1/daily-reports/:id', () => {
  const updateBody = {
    report_date: '2026-06-03',
    status: 'draft',
    problem: '更新後の課題',
    plan: '更新後の計画',
    visit_records: [{ customer_id: 0, visit_type: 'in_person', purpose: '更新後の目的', content: '内容' }],
  }

  it('TC-RPT-040 ○ 下書き日報の更新', async () => {
    const token = await login('yamada@example.com')
    const body = { ...updateBody, visit_records: [{ ...updateBody.visit_records[0], customer_id: customerId1 }] }
    const res = await reportPUT(req('PUT', `/api/v1/daily-reports/${reportId3}`, token, body), params(reportId3))
    expect(res.status).toBe(200)
    const data = await parseJson(res)
    expect(data.problem).toBe('更新後の課題')
  })

  it('TC-RPT-041 × 提出済み日報の更新（ステータス不正）', async () => {
    const token = await login('yamada@example.com')
    const body = { ...updateBody, report_date: '2026-06-02', visit_records: [{ ...updateBody.visit_records[0], customer_id: customerId1 }] }
    const res = await reportPUT(req('PUT', `/api/v1/daily-reports/${reportId2}`, token, body), params(reportId2))
    expect(res.status).toBe(403)
  })

  it('TC-RPT-042 × 他ユーザーの日報を更新しようとする', async () => {
    const token = await login('yamada@example.com')
    const body = { ...updateBody, report_date: '2026-06-02', visit_records: [{ ...updateBody.visit_records[0], customer_id: customerId1 }] }
    const res = await reportPUT(req('PUT', `/api/v1/daily-reports/${reportId4}`, token, body), params(reportId4))
    expect(res.status).toBe(403)
  })
})

// ──────────────────────────────────────────────────────────
// POST /api/v1/daily-reports/:id/submit
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/daily-reports/:id/submit', () => {
  it('TC-RPT-050 ○ 下書き日報の提出', async () => {
    // 提出可能な下書き日報を新規作成
    const token = await login('yamada@example.com')
    const created = await reportPOST(req('POST', '/api/v1/daily-reports', token, {
      report_date: '2026-06-20',
      status: 'draft',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' }],
    }))
    const createdData = await parseJson(created)
    const newId = createdData.id as number

    const res = await submitPOST(req('POST', `/api/v1/daily-reports/${newId}/submit`, token), params(newId))
    expect(res.status).toBe(200)
    const data = await parseJson(res)
    expect(data.status).toBe('submitted')
    expect(data.submitted_at).not.toBeNull()

    await prisma.visitRecord.deleteMany({ where: { dailyReportId: newId } })
    await prisma.dailyReport.delete({ where: { id: newId } })
  })

  it('TC-RPT-051 × 既に提出済みの日報を再提出', async () => {
    const token = await login('yamada@example.com')
    const res = await submitPOST(req('POST', `/api/v1/daily-reports/${reportId2}/submit`, token), params(reportId2))
    expect(res.status).toBe(403)
  })

  it('TC-RPT-052 × 訪問記録のない下書き日報を提出', async () => {
    const token = await login('yamada@example.com')
    // 訪問記録0件の下書き作成
    const emptyReport = await prisma.dailyReport.create({
      data: { userId: userId1, reportDate: new Date('2026-06-21'), status: 'draft' },
    })
    const res = await submitPOST(req('POST', `/api/v1/daily-reports/${emptyReport.id}/submit`, token), params(emptyReport.id))
    expect(res.status).toBe(400)
    const data = await parseJson(res)
    expect((data.error as Record<string, unknown>).code).toBe('BUSINESS_RULE_ERROR')
    await prisma.dailyReport.delete({ where: { id: emptyReport.id } })
  })
})

// ──────────────────────────────────────────────────────────
// POST /api/v1/daily-reports/:id/review
// ──────────────────────────────────────────────────────────

describe('POST /api/v1/daily-reports/:id/review', () => {
  it('TC-RPT-060 ○ 提出済み日報を確認済みにする', async () => {
    // 別途 submitted な日報を作って confirm する
    const salesToken = await login('yamada@example.com')
    const created = await reportPOST(req('POST', '/api/v1/daily-reports', salesToken, {
      report_date: '2026-06-25',
      status: 'submitted',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person', purpose: '目的', content: '内容' }],
    }))
    const createdData = await parseJson(created)
    const newId = createdData.id as number

    const token = await login('suzuki@example.com')
    const res = await reviewPOST(req('POST', `/api/v1/daily-reports/${newId}/review`, token), params(newId))
    expect(res.status).toBe(200)
    const data = await parseJson(res)
    expect(data.status).toBe('reviewed')
    expect(data.reviewed_at).not.toBeNull()

    await prisma.visitRecord.deleteMany({ where: { dailyReportId: newId } })
    await prisma.dailyReport.delete({ where: { id: newId } })
  })

  it('TC-RPT-061 × salesロールが確認済み処理を実行', async () => {
    const token = await login('yamada@example.com')
    const res = await reviewPOST(req('POST', `/api/v1/daily-reports/${reportId2}/review`, token), params(reportId2))
    expect(res.status).toBe(403)
  })

  it('TC-RPT-062 × 下書き日報を確認済みにしようとする', async () => {
    const token = await login('suzuki@example.com')
    const res = await reviewPOST(req('POST', `/api/v1/daily-reports/${reportId3}/review`, token), params(reportId3))
    expect(res.status).toBe(403)
  })
})
