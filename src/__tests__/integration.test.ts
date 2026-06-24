import { beforeAll, afterEach, afterAll, describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as listGET, POST as reportPOST } from '@/app/api/v1/daily-reports/route'
import { GET as detailGET } from '@/app/api/v1/daily-reports/[id]/route'
import { POST as submitPOST } from '@/app/api/v1/daily-reports/[id]/submit/route'
import { POST as reviewPOST } from '@/app/api/v1/daily-reports/[id]/review/route'
import { POST as commentsPOST } from '@/app/api/v1/daily-reports/[id]/comments/route'
import { POST as visitRecordsPOST } from '@/app/api/v1/daily-reports/[id]/visit-records/route'
import { DELETE as usersDELETE } from '@/app/api/v1/users/[id]/route'
import { DELETE as customersDELETE } from '@/app/api/v1/customers/[id]/route'

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
let customerId1: number  // 株式会社アルファ

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
  await prisma.user.create({
    data: { name: '佐藤 花子', email: 'sato@example.com', passwordDigest: digest, role: 'sales', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '鈴木 部長', email: 'suzuki@example.com', passwordDigest: digest, role: 'manager', department: '営業部' },
  })
  await prisma.user.create({
    data: { name: '管理者', email: 'admin@example.com', passwordDigest: digest, role: 'admin', department: '情報システム部' },
  })
  userId1 = u1.id

  const c1 = await prisma.customer.create({ data: { companyName: '株式会社アルファ', contactName: '田中 様', industry: '製造業' } })
  await prisma.customer.create({ data: { companyName: '△△商事', contactName: '鈴木 様', industry: '商社' } })
  customerId1 = c1.id
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
// 結合テスト
// ──────────────────────────────────────────────────────────

describe('TC-INT-001 ○ 日報作成から提出・コメントまでの一連フロー', () => {
  it('ステップ1〜9: 日報作成 → 提出 → コメント → 確認済み → 確認', async () => {
    // ステップ1: salesでログイン
    const salesToken = await login('yamada@example.com')
    expect(typeof salesToken).toBe('string')

    // ステップ2: 下書き日報を作成（訪問記録1件）
    const createRes = await reportPOST(req('POST', '/api/v1/daily-reports', salesToken, {
      report_date: '2026-07-01',
      status: 'draft',
      problem: '課題テスト',
      plan: '計画テスト',
      visit_records: [
        { customer_id: customerId1, visit_type: 'in_person', purpose: '新製品提案', content: 'デモ実施' },
      ],
    }))
    expect(createRes.status).toBe(201)
    const createData = await parseJson(createRes)
    const reportId = createData.id as number
    expect(createData.status).toBe('draft')

    // ステップ3: 日報を提出
    const submitRes = await submitPOST(req('POST', `/api/v1/daily-reports/${reportId}/submit`, salesToken), params(reportId))
    expect(submitRes.status).toBe(200)
    const submitData = await parseJson(submitRes)
    expect(submitData.status).toBe('submitted')

    // ステップ4: managerでログイン
    const managerToken = await login('suzuki@example.com')
    expect(typeof managerToken).toBe('string')

    // ステップ5: 全ユーザーの日報一覧に提出した日報が含まれる
    const listRes = await listGET(req('GET', '/api/v1/daily-reports', managerToken))
    expect(listRes.status).toBe(200)
    const listData = await listRes.json() as Array<{ id: number }>
    expect(listData.some((r) => r.id === reportId)).toBe(true)

    // ステップ6: 課題にコメントを投稿
    const commentRes = await commentsPOST(
      req('POST', `/api/v1/daily-reports/${reportId}/comments`, managerToken, {
        target: 'problem',
        body: '価格より価値訴求を優先しましょう。',
      }),
      params(reportId)
    )
    expect(commentRes.status).toBe(201)
    const commentData = await parseJson(commentRes)
    expect(commentData.target).toBe('problem')

    // ステップ7: 確認済みにする
    const reviewRes = await reviewPOST(req('POST', `/api/v1/daily-reports/${reportId}/review`, managerToken), params(reportId))
    expect(reviewRes.status).toBe(200)
    const reviewData = await parseJson(reviewRes)
    expect(reviewData.status).toBe('reviewed')

    // ステップ8: 再度salesでログイン
    const salesToken2 = await login('yamada@example.com')
    expect(typeof salesToken2).toBe('string')

    // ステップ9: 日報詳細を確認 — status が reviewed、コメントが含まれる
    const detailRes = await detailGET(req('GET', `/api/v1/daily-reports/${reportId}`, salesToken2), params(reportId))
    expect(detailRes.status).toBe(200)
    const detailData = await parseJson(detailRes)
    expect(detailData.status).toBe('reviewed')
    const comments = detailData.comments as Array<{ target: string; body: string }>
    expect(comments.some((c) => c.target === 'problem')).toBe(true)

    // 後片付け
    await prisma.comment.deleteMany({ where: { dailyReportId: reportId } })
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: reportId } })
    await prisma.dailyReport.delete({ where: { id: reportId } })
  })
})

describe('TC-INT-002 ○ ユーザー論理削除後のログイン不可確認', () => {
  it('ステップ1〜3: adminでユーザー削除 → 削除済みユーザーはログイン不可', async () => {
    // 削除対象ユーザーを一時作成
    const digest = hashPassword('Password1')
    const tmpUser = await prisma.user.create({
      data: { name: '一時ユーザー', email: 'tmp@example.com', passwordDigest: digest, role: 'sales', department: '営業部' },
    })

    // ステップ1: adminでログイン
    const adminToken = await login('admin@example.com')
    expect(typeof adminToken).toBe('string')

    // ステップ2: ユーザーを論理削除
    const deleteRes = await usersDELETE(req('DELETE', `/api/v1/users/${tmpUser.id}`, adminToken), params(tmpUser.id))
    expect(deleteRes.status).toBe(204)

    // ステップ3: 論理削除済みユーザーはログイン不可
    const loginRes = await loginPOST(
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tmp@example.com', password: 'Password1' }),
      })
    )
    expect(loginRes.status).toBe(401)
  })
})

describe('TC-INT-003 ○ 顧客論理削除後の訪問記録作成不可確認', () => {
  it('ステップ1〜4: admin で顧客削除 → sales で訪問記録作成不可', async () => {
    // 削除対象顧客を一時作成
    const tmpCustomer = await prisma.customer.create({
      data: { companyName: '削除予定会社', contactName: 'テスト様' },
    })

    // ステップ1: adminでログイン
    const adminToken = await login('admin@example.com')
    expect(typeof adminToken).toBe('string')

    // ステップ2: 顧客を論理削除
    const deleteRes = await customersDELETE(
      req('DELETE', `/api/v1/customers/${tmpCustomer.id}`, adminToken),
      params(tmpCustomer.id)
    )
    expect(deleteRes.status).toBe(204)

    // ステップ3: salesでログイン
    const salesToken = await login('yamada@example.com')
    expect(typeof salesToken).toBe('string')

    // 訪問記録追加用の下書き日報を準備
    const report = await prisma.dailyReport.create({
      data: {
        userId: userId1,
        reportDate: new Date('2026-07-10'),
        status: 'draft',
        visitRecords: {
          create: [{ customerId: customerId1, visitType: 'in_person', purpose: '既存の訪問' }],
        },
      },
    })

    // ステップ4: 論理削除済み顧客を使った訪問記録追加は 404
    const visitRes = await visitRecordsPOST(
      req('POST', `/api/v1/daily-reports/${report.id}/visit-records`, salesToken, {
        customer_id: tmpCustomer.id,
        visit_type: 'in_person',
        purpose: '目的',
        content: '内容',
      }),
      params(report.id)
    )
    expect(visitRes.status).toBe(404)

    // 後片付け
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: report.id } })
    await prisma.dailyReport.delete({ where: { id: report.id } })
  })
})

describe('TC-INT-004 ○ 同一ユーザー・同一日付の日報重複防止確認', () => {
  it('ステップ1〜3: salesで日報作成 → 同一日付で再作成すると 409', async () => {
    // ステップ1: salesでログイン
    const salesToken = await login('yamada@example.com')
    expect(typeof salesToken).toBe('string')

    // ステップ2: 日報を作成
    const createRes = await reportPOST(req('POST', '/api/v1/daily-reports', salesToken, {
      report_date: '2026-07-20',
      status: 'draft',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person' }],
    }))
    expect(createRes.status).toBe(201)
    const createData = await parseJson(createRes)
    const reportId = createData.id as number

    // ステップ3: 同一日付で再度作成すると 409
    const duplicateRes = await reportPOST(req('POST', '/api/v1/daily-reports', salesToken, {
      report_date: '2026-07-20',
      status: 'draft',
      visit_records: [{ customer_id: customerId1, visit_type: 'in_person' }],
    }))
    expect(duplicateRes.status).toBe(409)
    const duplicateData = await parseJson(duplicateRes)
    expect((duplicateData.error as Record<string, unknown>).code).toBe('CONFLICT')

    // 後片付け
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: reportId } })
    await prisma.dailyReport.delete({ where: { id: reportId } })
  })
})

describe('TC-INT-005 ○ 日報ステータス遷移の不正操作確認（draft → reviewed のスキップ不可）', () => {
  it('ステップ1〜2: managerが下書き日報を確認済みにしようとすると 403', async () => {
    // draft な日報を準備
    const report = await prisma.dailyReport.create({
      data: {
        userId: userId1,
        reportDate: new Date('2026-07-30'),
        status: 'draft',
        visitRecords: {
          create: [{ customerId: customerId1, visitType: 'in_person', purpose: '訪問' }],
        },
      },
    })

    // ステップ1: managerでログイン
    const managerToken = await login('suzuki@example.com')
    expect(typeof managerToken).toBe('string')

    // ステップ2: draft 日報を確認済みにしようとすると 403
    const reviewRes = await reviewPOST(
      req('POST', `/api/v1/daily-reports/${report.id}/review`, managerToken),
      params(report.id)
    )
    expect(reviewRes.status).toBe(403)

    // 後片付け
    await prisma.visitRecord.deleteMany({ where: { dailyReportId: report.id } })
    await prisma.dailyReport.delete({ where: { id: report.id } })
  })
})
