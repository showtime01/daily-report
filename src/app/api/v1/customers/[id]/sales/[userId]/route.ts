import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse } from '@/lib/response'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const auth = await requireRole(request, 'admin')
  if (auth instanceof Response) return auth

  const { id, userId } = await params
  const customerId = Number(id)
  const targetUserId = Number(userId)

  const assignment = await prisma.customerSales.findFirst({
    where: { customerId, userId: targetUserId },
  })
  if (!assignment) return errorResponse(404, 'NOT_FOUND', '担当営業の割り当てが存在しません')

  await prisma.customerSales.delete({ where: { id: assignment.id } })

  return new Response(null, { status: 204 })
}
