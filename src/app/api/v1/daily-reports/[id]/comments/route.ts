import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { CommentCreateSchema, CommentQuerySchema } from '@/lib/schemas/comments'

function formatComment(c: {
  id: number
  dailyReportId: number
  commenterId: number
  commenter: { name: string }
  target: string
  body: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: c.id,
    daily_report_id: c.dailyReportId,
    commenter_id: c.commenterId,
    commenter_name: c.commenter.name,
    target: c.target,
    body: c.body,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role === 'admin') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (user.role === 'sales' && report.userId !== user.id) {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const url = new URL(request.url)
  const queryResult = CommentQuerySchema.safeParse({ target: url.searchParams.get('target') ?? undefined })
  if (!queryResult.success) {
    const details = queryResult.error.issues.map((i) => ({
      field: String(i.path.at(-1) ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const where: { dailyReportId: number; target?: string } = { dailyReportId: reportId }
  if (queryResult.data.target) where.target = queryResult.data.target

  const comments = await prisma.comment.findMany({
    where,
    include: { commenter: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return jsonResponse(
    comments.map((c) => ({
      id: c.id,
      commenter_id: c.commenterId,
      commenter_name: c.commenter.name,
      target: c.target,
      body: c.body,
      created_at: c.createdAt.toISOString(),
    }))
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role !== 'manager') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const { id } = await params
  const reportId = Number(id)
  if (!Number.isInteger(reportId)) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  const report = await prisma.dailyReport.findUnique({ where: { id: reportId } })
  if (!report) return errorResponse(404, 'NOT_FOUND', '日報が存在しません')

  if (report.status === 'draft') {
    return errorResponse(403, 'FORBIDDEN', 'この日報にはコメントできません')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = CommentCreateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: String(i.path.at(-1) ?? ''),
      message: i.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const comment = await prisma.comment.create({
    data: {
      dailyReportId: reportId,
      commenterId: user.id,
      target: result.data.target,
      body: result.data.body,
    },
    include: { commenter: { select: { name: true } } },
  })

  return jsonResponse(formatComment(comment), 201)
}
