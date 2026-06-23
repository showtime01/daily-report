import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { CustomerUpdateSchema } from '@/lib/schemas/customers'

type Params = { params: Promise<{ id: string }> }

type CustomerWithSales = {
  id: number
  companyName: string
  contactName: string
  phone: string | null
  email: string | null
  address: string | null
  industry: string | null
  createdAt: Date
  updatedAt: Date
  customerSales: Array<{
    userId: number
    assignedAt: Date
    createdAt: Date
    user: { name: string; department: string | null }
  }>
}

function toDetail(customer: CustomerWithSales) {
  return {
    id: customer.id,
    company_name: customer.companyName,
    contact_name: customer.contactName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    industry: customer.industry,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
    sales: customer.customerSales.map((cs) => ({
      user_id: cs.userId,
      user_name: cs.user.name,
      department: cs.user.department,
      assigned_at: cs.assignedAt.toISOString().split('T')[0],
    })),
  }
}

const includeWithSales = {
  customerSales: {
    include: { user: true },
  },
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const customerId = Number(id)

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    include: includeWithSales,
  })
  if (!customer) return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')

  return jsonResponse(toDetail(customer))
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
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

  const result = CustomerUpdateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { company_name, contact_name, phone, email, address, industry, sales } = result.data

  await prisma.customer.update({
    where: { id: customerId },
    data: { companyName: company_name, contactName: contact_name, phone, email, address, industry },
  })

  if (sales !== undefined) {
    await prisma.customerSales.deleteMany({ where: { customerId } })
    if (sales.length > 0) {
      await prisma.customerSales.createMany({
        data: sales.map((s) => ({
          customerId,
          userId: s.user_id,
          assignedAt: new Date(s.assigned_at),
        })),
      })
    }
  }

  const updated = await prisma.customer.findFirst({
    where: { id: customerId },
    include: includeWithSales,
  })

  return jsonResponse(toDetail(updated!))
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id } = await params
  const customerId = Number(id)

  const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } })
  if (!customer) return errorResponse(404, 'NOT_FOUND', '顧客が存在しません')

  await prisma.customer.update({ where: { id: customerId }, data: { deletedAt: new Date() } })

  return new Response(null, { status: 204 })
}
