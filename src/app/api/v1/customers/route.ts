import { prisma } from '@/lib/prisma'
import { requireAuth, requireRole } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'
import { CustomerCreateSchema } from '@/lib/schemas/customers'

export async function GET(request: Request): Promise<Response> {
  const user = await requireAuth(request)
  if (user instanceof Response) return user

  if (user.role === 'manager') {
    return errorResponse(403, 'FORBIDDEN', 'アクセス権限がありません')
  }

  const where: Record<string, unknown> = { deletedAt: null }

  if (user.role === 'admin') {
    const url = new URL(request.url)
    const companyName = url.searchParams.get('company_name')
    const industry = url.searchParams.get('industry')
    if (companyName) where.companyName = { contains: companyName }
    if (industry) where.industry = { contains: industry }
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { companyName: 'asc' },
    include: {
      _count: { select: { customerSales: true } },
    },
  })

  const data = customers.map((c) => ({
    id: c.id,
    company_name: c.companyName,
    contact_name: c.contactName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    industry: c.industry,
    sales_count: c._count.customerSales,
    created_at: c.createdAt.toISOString(),
  }))

  return jsonResponse(data)
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', [])
  }

  const result = CustomerCreateSchema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }))
    return errorResponse(400, 'VALIDATION_ERROR', '入力内容に誤りがあります', details)
  }

  const { company_name, contact_name, phone, email, address, industry, sales } = result.data

  const customer = await prisma.customer.create({
    data: {
      companyName: company_name,
      contactName: contact_name,
      phone,
      email,
      address,
      industry,
      customerSales: sales
        ? {
            create: sales.map((s) => ({
              userId: s.user_id,
              assignedAt: new Date(s.assigned_at),
            })),
          }
        : undefined,
    },
    include: {
      customerSales: {
        include: { user: true },
      },
    },
  })

  return jsonResponse(toCustomerDetail(customer), 201)
}

function toCustomerDetail(customer: {
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
}) {
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
