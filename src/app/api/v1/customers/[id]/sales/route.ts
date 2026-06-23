import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { CustomerSalesAddSchema } from '@/lib/schemas/customers'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const customerId = Number(id)

  const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } })
  if (!customer) return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = CustomerSalesAddSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { user_id, assigned_at } = result.data

  const targetUser = await prisma.user.findFirst({ where: { id: user_id, deletedAt: null } })
  if (!targetUser) return errorResponse(404, 'NOT_FOUND', 'ユーザーが存在しません')

  if (targetUser.role !== 'sales') {
    return errorResponse(400, 'BUSINESS_RULE_ERROR', 'salesロールのユーザーのみ担当営業に設定できます')
  }

  const existing = await prisma.customerSales.findFirst({ where: { customerId, userId: user_id } })
  if (existing) {
    return errorResponse(409, 'CONFLICT', 'この担当者は既に追加されています')
  }

  const assignment = await prisma.customerSales.create({
    data: { customerId, userId: user_id, assignedAt: new Date(assigned_at) },
    include: { user: true },
  })

  return jsonResponse(
    {
      customer_id: customerId,
      user_id: assignment.userId,
      user_name: assignment.user.name,
      department: assignment.user.department,
      assigned_at: assignment.assignedAt.toISOString().split('T')[0],
      created_at: assignment.createdAt.toISOString(),
    },
    201
  )
}
