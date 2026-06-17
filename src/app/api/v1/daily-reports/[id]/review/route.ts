import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { formatDetail } from '../../route'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireRole(request, 'manager')
  if (user instanceof Response) return user

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (report.status !== 'submitted') {
    return errorResponse(403, 'FORBIDDEN', 'ステータスが提出済みの日報のみ確認済みにできます')
  }

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: 'reviewed', reviewedAt: new Date() },
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
