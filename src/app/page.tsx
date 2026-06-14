import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'

export default async function RootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_id')?.value
  const user = await getSessionUser(token)

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'sales') redirect('/reports')
  if (user.role === 'manager') redirect('/manager/reports')
  if (user.role === 'admin') redirect('/admin/users')

  redirect('/login')
}
