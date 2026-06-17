import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { DailyReportCreateSchema, DailyReportQuerySchema } from '@/lib/schemas/daily-reports'

function toDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role === 'admin') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const url = new URL(request.url)
  const queryResult = DailyReportQuerySchema.safeParse({
    date_from: url.searchParams.get('date_from') ?? undefined,
    date_to: url.searchParams.get('date_to') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    user_id: url.searchParams.get('user_id') ?? undefined,
  })

  if (!queryResult.success) {
    const details = queryResult.error.issues.map((i) => ({
      field: String(i.path[0] ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { date_from, date_to, status, user_id } = queryResult.data

  if (date_from && date_to && date_from > date_to) {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [
      { field: 'date_from', message: '開始日は終了日以前を指定してください' },
    ])
  }

  const where: Record<string, unknown> = {}

  if (user.role === 'sales') {
    where.userId = user.id
  } else {
    // manager
    if (user_id) where.userId = user_id
  }

  if (status) where.status = status
  if (date_from) where.reportDate = { ...(where.reportDate as object | undefined), gte: new Date(date_from) }
  if (date_to) {
    const end = new Date(date_to)
    end.setHours(23, 59, 59, 999)
    where.reportDate = { ...(where.reportDate as object | undefined), lte: end }
  }

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { reportDate: 'desc' },
    include: {
      user: { select: { id: true, name: true } },
      visitRecords: { select: { id: true } },
    },
  })

  const data = reports.map((r) => ({
    id: r.id,
    report_date: toDateISO(r.reportDate),
    status: r.status,
    visit_count: r.visitRecords.length,
    submitted_at: r.submittedAt?.toISOString() ?? null,
    user: { id: r.user.id, name: r.user.name },
  }))

  return jsonResponse(data)
}

export async function POST(request: Request): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role !== 'sales') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  // 提出時の訪問記録0件はバリデーションエラーではなくビジネスルールエラー
  const raw = body as Record<string, unknown>
  if (raw.status === 'submitted' && Array.isArray(raw.visit_records) && raw.visit_records.length === 0) {
    return errorResponse(400, 'BUSINESS_RULE_ERROR', '訪問記録を1件以上追加してください')
  }

  const result = DailyReportCreateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: String(i.path.at(-1) ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { report_date, problem, plan, status, visit_records } = result.data

  if (status === 'submitted' && visit_records.length === 0) {
    return errorResponse(400, 'BUSINESS_RULE_ERROR', '訪問記録を1件以上追加してください')
  }

  // 顧客の存在確認（論理削除チェック）
  for (const vr of visit_records) {
    const customer = await prisma.customer.findFirst({
      where: { id: vr.customer_id, deletedAt: null },
    })
    if (!customer) {
      return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')
    }
  }

  // 次回訪問予定日が過去日でないかチェック（提出時のみ）
  if (status === 'submitted') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const vr of visit_records) {
      if (vr.next_visit_date) {
        const nvd = new Date(vr.next_visit_date)
        if (nvd < today) {
          return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [
            { field: 'next_visit_date', message: '次回訪問予定日は本日以降を指定してください' },
          ])
        }
      }
    }
  }

  try {
    const report = await prisma.dailyReport.create({
      data: {
        userId: user.id,
        reportDate: new Date(report_date),
        problem: problem ?? null,
        plan: plan ?? null,
        status,
        submittedAt: status === 'submitted' ? new Date() : null,
        visitRecords: {
          create: visit_records.map((vr) => ({
            customerId: vr.customer_id,
            visitType: vr.visit_type,
            purpose: vr.purpose ?? null,
            content: vr.content ?? null,
            nextAction: vr.next_action ?? null,
            nextVisitDate: vr.next_visit_date ? new Date(vr.next_visit_date) : null,
          })),
        },
      },
      include: {
        user: { select: { id: true, name: true, department: true } },
        visitRecords: {
          include: { customer: { select: { companyName: true } } },
        },
        comments: {
          include: { commenter: { select: { name: true } } },
        },
      },
    })

    return jsonResponse(formatDetail(report), 201)
  } catch (e: unknown) {
    if (
      e !== null &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    ) {
      return errorResponse(409, 'CONFLICT', '本日の日報は既に存在します')
    }
    throw e
  }
}

type VisitRecordRow = {
  id: number; dailyReportId: number; customerId: number; visitType: string
  purpose: string | null; content: string | null; nextAction: string | null
  nextVisitDate: Date | null; createdAt: Date; updatedAt: Date
  customer: { companyName: string }
}
type CommentRow = {
  id: number; commenterId: number; target: string; body: string; createdAt: Date
  commenter: { name: string }
}
type ReportRow = {
  id: number; reportDate: Date; status: string; problem: string | null; plan: string | null
  submittedAt: Date | null; reviewedAt: Date | null; createdAt: Date; updatedAt: Date
  user: { id: number; name: string; department: string | null }
  visitRecords: VisitRecordRow[]
  comments: CommentRow[]
}

function formatDetail(r: ReportRow) {
  return {
    id: r.id,
    report_date: toDateISO(r.reportDate),
    status: r.status,
    problem: r.problem,
    plan: r.plan,
    submitted_at: r.submittedAt?.toISOString() ?? null,
    reviewed_at: r.reviewedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    user: {
      id: r.user.id,
      name: r.user.name,
      department: r.user.department,
    },
    visit_records: r.visitRecords.map((vr) => ({
      id: vr.id,
      daily_report_id: vr.dailyReportId,
      customer_id: vr.customerId,
      customer_name: vr.customer.companyName,
      visit_type: vr.visitType,
      purpose: vr.purpose,
      content: vr.content,
      next_action: vr.nextAction,
      next_visit_date: vr.nextVisitDate ? toDateISO(vr.nextVisitDate) : null,
      created_at: vr.createdAt.toISOString(),
      updated_at: vr.updatedAt.toISOString(),
    })),
    comments: r.comments.map((c) => ({
      id: c.id,
      commenter_id: c.commenterId,
      commenter_name: c.commenter.name,
      target: c.target,
      body: c.body,
      created_at: c.createdAt.toISOString(),
    })),
  }
}

export { formatDetail }
