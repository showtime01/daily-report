import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { DailyReportUpdateSchema } from '@/lib/schemas/daily-reports'
import { formatDetail } from '../route'

function toDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function fetchDetail(id: number) {
  return prisma.dailyReport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, department: true } },
      visitRecords: {
        include: { customer: { select: { companyName: true } } },
        orderBy: { id: 'asc' },
      },
      comments: {
        include: { commenter: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  const report = await fetchDetail(reportId)
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (user.role === 'sales' && report.userId !== user.id) {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  return jsonResponse(formatDetail(report))
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role !== 'sales') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (report.userId !== user.id) {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  if (report.status !== 'draft') {
    return errorResponse(403, 'FORBIDDEN', '下書き以外の日報は更新できません')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = DailyReportUpdateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: String(i.path.at(-1) ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { report_date, problem, plan, status, visit_records } = result.data

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

  for (const vr of visit_records) {
    const customer = await prisma.customer.findFirst({
      where: { id: vr.customer_id, deletedAt: null },
    })
    if (!customer) return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')
  }

  // 訪問記録を全置換
  await prisma.visitRecord.deleteMany({ where: { dailyReportId: reportId } })

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      reportDate: new Date(report_date),
      problem: problem ?? null,
      plan: plan ?? null,
      status,
      submittedAt: status === 'submitted' ? new Date() : report.submittedAt,
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
        orderBy: { id: 'asc' },
      },
      comments: {
        include: { commenter: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return jsonResponse(formatDetail(updated))
}

export { toDateISO }
