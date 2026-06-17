'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'

type Report = {
  id: number
  report_date: string
  status: string
  visit_count: number
  submitted_at: string | null
  user: { id: number; name: string }
}

type User = {
  id: number
  name: string
  role: string
}

type Filters = {
  dateFrom: string
  dateTo: string
  status: string
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

const DEFAULT_FILTERS: Filters = {
  dateFrom: firstDayOfMonth(),
  dateTo: today(),
  status: '',
}

export default function SalesReportsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [dateFrom, setDateFrom] = useState(DEFAULT_FILTERS.dateFrom)
  const [dateTo, setDateTo] = useState(DEFAULT_FILTERS.dateTo)
  const [status, setStatus] = useState('')
  const [activeFilters, setActiveFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [dateError, setDateError] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasTodayReport, setHasTodayReport] = useState(false)

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null }
        return r.json() as Promise<User>
      })
      .then((u) => {
        if (!u) return
        if (u.role !== 'sales') { router.push('/login'); return }
        setCurrentUser(u)
      })
  }, [router])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function doFetch() {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeFilters.dateFrom) params.set('date_from', activeFilters.dateFrom)
      if (activeFilters.dateTo) params.set('date_to', activeFilters.dateTo)
      if (activeFilters.status) params.set('status', activeFilters.status)

      const res = await fetch(`/api/v1/daily-reports?${params}`)
      if (res.ok && !cancelled) {
        const data = await res.json() as Report[]
        setReports(data)
        setHasTodayReport(data.some((r) => r.report_date === today()))
      }
      if (!cancelled) setLoading(false)
    }

    doFetch()
    return () => { cancelled = true }
  }, [currentUser, activeFilters])

  function handleSearch() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setDateError('開始日は終了日以前を指定してください')
      return
    }
    setDateError('')
    setActiveFilters({ dateFrom, dateTo, status })
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">日報一覧</h1>
          {!hasTodayReport && (
            <button
              onClick={() => router.push('/reports/new')}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              + 本日の日報を作成
            </button>
          )}
        </div>

        {/* フィルタ */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">期間（開始）</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <span className="text-gray-400 pb-1">〜</span>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">期間（終了）</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">すべて</option>
              <option value="draft">下書き</option>
              <option value="submitted">提出済み</option>
              <option value="reviewed">確認済み</option>
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            検索
          </button>
        </div>

        {dateError && (
          <p className="mb-3 text-sm text-red-600">{dateError}</p>
        )}

        {/* テーブル */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">読み込み中...</p>
          ) : reports.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">該当する日報はありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">報告日</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">訪問件数</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">提出日時</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{formatDate(r.report_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-700">{r.visit_count}件</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.submitted_at ? formatDatetime(r.submitted_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'draft' ? (
                        <button
                          onClick={() => router.push(`/reports/${r.id}/edit`)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          編集
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/reports/${r.id}`)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          詳細
                        </button>
                      )}
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
