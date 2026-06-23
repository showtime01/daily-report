'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'

type Customer = {
  id: number
  company_name: string
  contact_name: string
  industry: string | null
  sales_count: number
}

type CurrentUser = {
  id: number
  name: string
  role: string
}

export default function AdminCustomersPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [activeCompanyName, setActiveCompanyName] = useState('')
  const [activeIndustry, setActiveIndustry] = useState('')
  const [loading, setLoading] = useState(true)
  const [error403, setError403] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null }
        return r.json() as Promise<CurrentUser>
      })
      .then((u) => {
        if (!u) return
        if (u.role !== 'admin') { setError403(true); return }
        setCurrentUser(u)
      })
  }, [router])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function doFetch() {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeCompanyName) params.set('company_name', activeCompanyName)
      if (activeIndustry) params.set('industry', activeIndustry)
      const res = await fetch(`/api/v1/customers?${params}`)
      if (res.ok && !cancelled) {
        setCustomers(await res.json() as Customer[])
      }
      if (!cancelled) setLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [currentUser, activeCompanyName, activeIndustry, refreshKey])

  function handleSearch() {
    setActiveCompanyName(companyName)
    setActiveIndustry(industry)
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`「${customer.company_name}」を削除してよろしいですか？`)) return
    const res = await fetch(`/api/v1/customers/${customer.id}`, { method: 'DELETE' })
    if (res.ok) {
      setRefreshKey((k) => k + 1)
    }
  }

  if (error403) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">403 アクセス権限がありません</p>
          <button onClick={() => router.push('/login')} className="mt-4 text-sm text-blue-600 underline">
            ログインページへ
          </button>
        </div>
      </div>
    )
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} showAdminNav />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">顧客マスタ一覧</h1>
          <button
            onClick={() => router.push('/admin/customers/new')}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + 顧客を登録
          </button>
        </div>

        {/* フィルタ */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">企業名</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="部分一致"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 w-48"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">業種</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="部分一致"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 w-48"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            検索
          </button>
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">読み込み中...</p>
          ) : customers.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">該当する顧客はいません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">企業名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">担当者名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">業種</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">担当営業数</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.company_name}</td>
                    <td className="px-4 py-3 text-gray-700">{c.contact_name}</td>
                    <td className="px-4 py-3 text-gray-700">{c.industry ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.sales_count}名</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        onClick={() => router.push(`/admin/customers/${c.id}/edit`)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
