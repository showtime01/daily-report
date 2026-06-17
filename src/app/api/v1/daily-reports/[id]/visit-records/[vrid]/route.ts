import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { VisitRecordInputSchema } from '@/lib/schemas/visit-records'

function formatVisitRecord(vr: {
  id: number
  dailyReportId: number
  customerId: number
  customer: { companyName: string }
  visitType: string
  purpose: string | null
  content: string | null
  nextAction: string | null
  nextVisitDate: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: vr.id,
    daily_report_id: vr.dailyReportId,
    customer_id: vr.customerId,
    customer_name: vr.customer.companyName,
    visit_type: vr.visitType,
    purpose: vr.purpose,
    content: vr.content,
    next_action: vr.nextAction,
    next_visit_date: vr.nextVisitDate ? vr.nextVisitDate.toISOString().split('T')[0] : null,
    created_at: vr.createdAt.toISOString(),
    updated_at: vr.updatedAt.toISOString(),
  }
}

async function getReportAndVisitRecord(reportId: number, vrid: number, userId: number) {
  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) return { error: errorResponse(404, 'NOT_FOUND', '日報が存在しません') }

  if (report.userId !== userId) {
    return { error: errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません') }
  }

  if (report.status !== 'draft') {
    return { error: errorResponse(403, 'FORBIDDEN', '下書き以外の日報は操作できません') }
  }

  const visitRecord = await prisma.visitRecord.findUnique({ where: { id: vrid } })
  if (!visitRecord || visitRecord.dailyReportId !== reportId) {
    return { error: errorResponse(404, 'NOT_FOUND', '訪問記録が存在しません') }
  }

  return { report, visitRecord }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; vrid: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role !== 'sales') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const { id, vrid } = await params
  const reportId = Number(id)
  const visitRecordId = Number(vrid)

  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')
  if (!Number.isInteger(visitRecordId)) return errorResponse(404, 'NOT_FOUND', '訪問記録が存在しません')

  const checked = await getReportAndVisitRecord(reportId, visitRecordId, user.id)
  if ('error' in checked) return checked.error as Response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = VisitRecordInputSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: String(i.path.at(-1) ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { customer_id, visit_type, purpose, content, next_action, next_visit_date } = result.data

  const customer = await prisma.customer.findFirst({
    where: { id: customer_id, deletedAt: null },
  })
  if (!customer) return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')

  const updated = await prisma.visitRecord.update({
    where: { id: visitRecordId },
    data: {
      customerId: customer_id,
      visitType: visit_type,
      purpose: purpose ?? null,
      content: content ?? null,
      nextAction: next_action ?? null,
      nextVisitDate: next_visit_date ? new Date(next_visit_date) : null,
    },
    include: { customer: { select: { companyName: true } } },
  })

  return jsonResponse(formatVisitRecord(updated))
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; vrid: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role !== 'sales') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const { id, vrid } = await params
  const reportId = Number(id)
  const visitRecordId = Number(vrid)

  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')
  if (!Number.isInteger(visitRecordId)) return errorResponse(404, 'NOT_FOUND', '訪問記録が存在しません')

  const checked = await getReportAndVisitRecord(reportId, visitRecordId, user.id)
  if ('error' in checked) return checked.error as Response

  const count = await prisma.visitRecord.count({ where: { dailyReportId: reportId } })
  if (count <= 1) {
    return errorResponse(400, 'BUSINESS_RULE_ERROR', '最後の訪問記録は削除できません')
  }

  await prisma.visitRecord.delete({ where: { id: visitRecordId } })

  return new Response(null, { status: 204 })
}
