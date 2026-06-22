import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { errorResponse, jsonResponse } from '@/lib/response'

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
