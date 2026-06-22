'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'

type User = { id: number; name: string; role: string }
type VisitRecord = {
  id: number
  customer_name: string
  visit_type: 'in_person' | 'online' | 'phone'
  purpose: string | null
  content: string | null
  next_action: string | null
  next_visit_date: string | null
}
type Comment = {
  id: number
  commenter_name: string
  target: string
  body: string
  created_at: string
}
type ReportDetail = {
  id: number
  report_date: string
  status: string
  problem: string | null
  plan: string | null
  visit_records: VisitRecord[]
  comments: Comment[]
}

const VISIT_TYPE_LABEL: Record<string, string> = {
  in_person: '対面',
  online: 'オンライン',
  phone: '電話',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDateWithDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${iso.replace(/-/g, '/')}（${WEEKDAYS[date.getDay()]}）`
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return null
  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
      <p className="text-xs font-medium text-gray-500">上長コメント</p>
      {comments.map((c) => (
        <div key={c.id} className="rounded border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-700">{c.commenter_name}</span>
            <span className="text-xs text-gray-400">{formatDatetime(c.created_at)}</span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}
    </div>
  )
}

export default function ReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = Number(params.id)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function init() {
      const meRes = await fetch('/api/v1/auth/me')
      if (!meRes.ok) { router.push('/login'); return }
      const me = (await meRes.json()) as User
      if (me.role !== 'sales') { router.push('/login'); return }
      setCurrentUser(me)

      const reportRes = await fetch(`/api/v1/daily-reports/${reportId}`)
      if (!reportRes.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const data = (await reportRes.json()) as ReportDetail
      if (data.status === 'draft') {
        router.push(`/reports/${reportId}/edit`)
        return
      }
      setReport(data)
      setLoading(false)
    }
    init()
  }, [router, reportId])

  if (loading) return null

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {currentUser && <Header userName={currentUser.name} />}
        <main className="flex-1 p-6 text-center">
          <p className="text-gray-500 mb-4">日報が見つかりません</p>
          <button
            onClick={() => router.push('/reports')}
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            一覧に戻る
          </button>
        </main>
      </div>
    )
  }

  if (!currentUser || !report) return null

  const problemComments = report.comments.filter((c) => c.target === 'problem')
  const planComments = report.comments.filter((c) => c.target === 'plan')
  const generalComments = report.comments.filter((c) => c.target === 'general')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {/* タイトル */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">
            日報詳細　{formatDateWithDay(report.report_date)}
          </h1>
          <StatusBadge status={report.status} />
        </div>

        {/* 訪問記録 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">訪問記録</h2>
          <div className="space-y-4">
            {report.visit_records.map((vr, idx) => (
              <div key={vr.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">訪問 #{idx + 1}</p>
                <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">顧客</dt>
                  <dd className="text-gray-900">{vr.customer_name}</dd>
                  <dt className="text-gray-500">種別</dt>
                  <dd className="text-gray-900">{VISIT_TYPE_LABEL[vr.visit_type]}</dd>
                  {vr.purpose && (
                    <>
                      <dt className="text-gray-500">目的</dt>
                      <dd className="text-gray-900">{vr.purpose}</dd>
                    </>
                  )}
                  {vr.content && (
                    <>
                      <dt className="text-gray-500">内容</dt>
                      <dd className="text-gray-900 whitespace-pre-wrap">{vr.content}</dd>
                    </>
                  )}
                  {vr.next_action && (
                    <>
                      <dt className="text-gray-500">次回アクション</dt>
                      <dd className="text-gray-900">{vr.next_action}</dd>
                    </>
                  )}
                  {vr.next_visit_date && (
                    <>
                      <dt className="text-gray-500">次回訪問予定日</dt>
                      <dd className="text-gray-900">{vr.next_visit_date.replace(/-/g, '/')}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* 課題・相談 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">課題・相談</h2>
          {report.problem ? (
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{report.problem}</p>
          ) : (
            <p className="text-sm text-gray-400">（未入力）</p>
          )}
          <CommentList comments={problemComments} />
        </section>

        {/* 明日やること */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">明日やること</h2>
          {report.plan ? (
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{report.plan}</p>
          ) : (
            <p className="text-sm text-gray-400">（未入力）</p>
          )}
          <CommentList comments={planComments} />
        </section>

        {/* 全般コメント（存在する場合のみ表示） */}
        {generalComments.length > 0 && (
          <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-base font-semibold text-gray-800 mb-3">全般コメント</h2>
            <CommentList comments={generalComments} />
          </section>
        )}

        <div className="pb-8">
          <button
            onClick={() => router.push('/reports')}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← 一覧に戻る
          </button>
        </div>
      </main>
    </div>
  )
}
