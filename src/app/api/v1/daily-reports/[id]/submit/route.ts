import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { formatDetail } from '../../route'

export async function POST(
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

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: { visitRecords: { select: { id: true } } },
  })
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (report.userId !== user.id || report.status !== 'draft') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  if (report.visitRecords.length === 0) {
    return errorResponse(400, 'BUSINESS_RULE_ERROR', '訪問記録を1件以上追加してください')
  }

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: 'submitted', submittedAt: new Date() },
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
