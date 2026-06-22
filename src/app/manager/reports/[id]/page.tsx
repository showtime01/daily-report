'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'
import { VISIT_TYPE_LABEL } from '@/lib/constants'

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
  user: { id: number; name: string; department: string | null }
  visit_records: VisitRecord[]
  comments: Comment[]
}

type CommentTarget = 'problem' | 'plan' | 'general'


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

const COMMENT_BUTTON_LABEL: Record<CommentTarget, string> = {
  problem: '課題にコメントする',
  plan: '計画にコメントする',
  general: '全般にコメントする',
}

type CommentSectionProps = {
  target: CommentTarget
  comments: Comment[]
  reportId: number
  canComment: boolean
  onPosted: () => Promise<void>
}

function CommentSection({ target, comments, reportId, canComment, onPosted }: CommentSectionProps) {
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)

  async function handlePost() {
    const trimmed = body.trim()
    if (!trimmed) { setError('コメントを入力してください'); return }
    if (trimmed.length > 1000) { setError('コメントは1000文字以内で入力してください'); return }
    setError('')
    setPosting(true)
    try {
      const res = await fetch(`/api/v1/daily-reports/${reportId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, body: trimmed }),
      })
      if (res.ok) {
        setBody('')
        await onPosted()
      } else {
        const data = (await res.json()) as { error?: { message?: string } }
        setError(data?.error?.message ?? 'コメントの投稿に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      {/* 既存コメント一覧 */}
      {comments.length > 0 && (
        <div className="mb-4 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
          {comments.map((c) => (
            <div key={c.id} className="border-b border-gray-200 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700">{c.commenter_name}</span>
                <span className="text-xs text-gray-400">{formatDatetime(c.created_at)}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* コメント入力フォーム */}
      {canComment && (
        <div>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); if (error) setError('') }}
            placeholder="コメントを入力..."
            rows={3}
            maxLength={1000}
            className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 resize-y ${
              error ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handlePost}
            disabled={posting}
            className="mt-2 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {COMMENT_BUTTON_LABEL[target]}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ManagerReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = Number(params.id)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/v1/daily-reports/${reportId}`)
    if (res.ok) {
      setReport((await res.json()) as ReportDetail)
    }
  }, [reportId])

  useEffect(() => {
    async function init() {
      const meRes = await fetch('/api/v1/auth/me')
      if (!meRes.ok) { router.push('/login'); return }
      const me = (await meRes.json()) as User
      if (me.role !== 'manager') { router.push('/login'); return }
      setCurrentUser(me)

      const reportRes = await fetch(`/api/v1/daily-reports/${reportId}`)
      if (!reportRes.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setReport((await reportRes.json()) as ReportDetail)
      setLoading(false)
    }
    init()
  }, [router, reportId])

  async function handleReview() {
    setReviewError('')
    setReviewing(true)
    try {
      const res = await fetch(`/api/v1/daily-reports/${reportId}/review`, { method: 'POST' })
      if (res.ok) {
        await fetchReport()
      } else {
        const data = (await res.json()) as { error?: { message?: string } }
        setReviewError(data?.error?.message ?? '確認済み処理に失敗しました')
      }
    } catch {
      setReviewError('通信エラーが発生しました')
    } finally {
      setReviewing(false)
    }
  }

  if (loading) return null

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {currentUser && <Header userName={currentUser.name} />}
        <main className="flex-1 p-6 text-center">
          <p className="text-gray-500 mb-4">日報が見つかりません</p>
          <button
            onClick={() => router.push('/manager/reports')}
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            一覧に戻る
          </button>
        </main>
      </div>
    )
  }

  if (!currentUser || !report) return null

  const canComment = report.status !== 'draft'
  const problemComments = report.comments.filter((c) => c.target === 'problem')
  const planComments = report.comments.filter((c) => c.target === 'plan')
  const generalComments = report.comments.filter((c) => c.target === 'general')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {/* タイトル行 */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">日報詳細（上長）</h1>
            <p className="text-sm text-gray-600 mt-1">
              {report.user.name}　/　{formatDateWithDay(report.report_date)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={report.status} />
            {report.status === 'submitted' && (
              <button
                type="button"
                onClick={handleReview}
                disabled={reviewing}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                確認済みにする
              </button>
            )}
          </div>
        </div>

        {reviewError && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{reviewError}</p>
          </div>
        )}

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
            <p className="text-sm text-gray-900 whitespace-pre-wrap mb-4">{report.problem}</p>
          ) : (
            <p className="text-sm text-gray-400 mb-4">（未入力）</p>
          )}
          <CommentSection
            key={`problem-${report.comments.length}`}
            target="problem"
            comments={problemComments}
            reportId={reportId}
            canComment={canComment}
            onPosted={fetchReport}
          />
        </section>

        {/* 明日やること */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">明日やること</h2>
          {report.plan ? (
            <p className="text-sm text-gray-900 whitespace-pre-wrap mb-4">{report.plan}</p>
          ) : (
            <p className="text-sm text-gray-400 mb-4">（未入力）</p>
          )}
          <CommentSection
            key={`plan-${report.comments.length}`}
            target="plan"
            comments={planComments}
            reportId={reportId}
            canComment={canComment}
            onPosted={fetchReport}
          />
        </section>

        {/* 全般コメント */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">全般コメント</h2>
          <CommentSection
            key={`general-${report.comments.length}`}
            target="general"
            comments={generalComments}
            reportId={reportId}
            canComment={canComment}
            onPosted={fetchReport}
          />
        </section>

        <div className="pb-8">
          <button
            onClick={() => router.push('/manager/reports')}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← 一覧に戻る
          </button>
        </div>
      </main>
    </div>
  )
}
