'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

type Props = {
  userName: string
  showAdminNav?: boolean
}

const ADMIN_TABS = [
  { label: 'ユーザー管理', href: '/admin/users' },
  { label: '顧客管理', href: '/admin/customers' },
]

export default function Header({ userName, showAdminNav = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-800">営業日報システム</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 underline"
          >
            ログアウト
          </button>
        </div>
      </div>
      {showAdminNav && (
        <nav className="px-6 flex gap-1 border-t border-gray-100">
          {ADMIN_TABS.map((tab) => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
