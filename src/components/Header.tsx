'use client'

import { useRouter } from 'next/navigation'

type Props = {
  userName: string
}

export default function Header({ userName }: Props) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
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
    </header>
  )
}
