'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VISIT_TYPE_LABEL } from '@/lib/constants'

type Customer = { id: number; company_name: string }
type VisitType = 'in_person' | 'online' | 'phone'

export type VisitRecordForm = {
  customer_id: number | ''
  visit_type: VisitType | ''
  purpose: string
  content: string
  next_action: string
  next_visit_date: string
}

type VisitErrors = {
  customer_id?: string
  visit_type?: string
  purpose?: string
  content?: string
  next_action?: string
  next_visit_date?: string
}

type FormErrors = {
  general?: string
  problem?: string
  plan?: string
  visits?: VisitErrors[]
}

type Props = {
  reportDate: string
  reportId?: number
  initialProblem: string
  initialPlan: string
  initialVisits: VisitRecordForm[]
  customers: Customer[]
}

const VISIT_TYPE_LABELS = VISIT_TYPE_LABEL as Record<VisitType, string>

function emptyVisit(): VisitRecordForm {
  return {
    customer_id: '',
    visit_type: '',
    purpose: '',
    content: '',
    next_action: '',
    next_visit_date: '',
  }
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function hasFormErrors(errs: FormErrors): boolean {
  if (errs.general || errs.problem || errs.plan) return true
  if (errs.visits?.some((ve) => Object.keys(ve).length > 0)) return true
  return false
}

export default function ReportForm({
  reportDate,
  reportId,
  initialProblem,
  initialPlan,
  initialVisits,
  customers,
}: Props) {
  const router = useRouter()
  const [visits, setVisits] = useState<VisitRecordForm[]>(
    initialVisits.length > 0 ? initialVisits : [emptyVisit()]
  )
  const [problem, setProblem] = useState(initialProblem)
  const [plan, setPlan] = useState(initialPlan)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function updateVisit(idx: number, patch: Partial<VisitRecordForm>) {
    setVisits((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  function addVisit() {
    setVisits((prev) => [...prev, emptyVisit()])
  }

  function removeVisit(idx: number) {
    if (visits.length <= 1) return
    setVisits((prev) => prev.filter((_, i) => i !== idx))
  }

  function validate(isDraft: boolean): FormErrors {
    const errs: FormErrors = {}

    const visitErrs: VisitErrors[] = visits.map((v) => {
      const ve: VisitErrors = {}

      if (!v.customer_id) ve.customer_id = '顧客を選択してください'
      if (!v.visit_type) ve.visit_type = '訪問種別を選択してください'

      if (!isDraft && !v.purpose) {
        ve.purpose = '訪問目的を入力してください'
      } else if (v.purpose.length > 200) {
        ve.purpose = '訪問目的は200文字以内で入力してください'
      }

      if (!isDraft && !v.content) {
        ve.content = '訪問内容を入力してください'
      } else if (v.content.length > 1000) {
        ve.content = '訪問内容は1000文字以内で入力してください'
      }

      if (v.next_action.length > 500) {
        ve.next_action = '次回アクションは500文字以内で入力してください'
      }

      if (!isDraft && v.next_visit_date && v.next_visit_date < todayStr()) {
        ve.next_visit_date = '次回訪問予定日は本日以降を指定してください'
      }

      return ve
    })

    if (visitErrs.some((ve) => Object.keys(ve).length > 0)) {
      errs.visits = visitErrs
    }

    if (!isDraft && visits.length === 0) {
      errs.general = '訪問記録を1件以上追加してください'
    }

    if (problem.length > 2000) errs.problem = '課題・相談は2000文字以内で入力してください'
    if (plan.length > 2000) errs.plan = '明日やることは2000文字以内で入力してください'

    return errs
  }

  async function handleSave(isDraft: boolean) {
    const errs = validate(isDraft)
    if (hasFormErrors(errs)) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)

    const body = {
      report_date: reportDate,
      problem: problem || undefined,
      plan: plan || undefined,
      status: isDraft ? 'draft' : 'submitted',
      visit_records: visits.map((v) => ({
        customer_id: v.customer_id as number,
        visit_type: v.visit_type as VisitType,
        purpose: v.purpose || undefined,
        content: v.content || undefined,
        next_action: v.next_action || undefined,
        next_visit_date: v.next_visit_date || null,
      })),
    }

    const url = reportId
      ? `/api/v1/daily-reports/${reportId}`
      : '/api/v1/daily-reports'
    const method = reportId ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/reports')
        return
      }

      const data = (await res.json()) as {
        error?: { code?: string; message?: string }
      }
      const code = data?.error?.code

      if (code === 'CONFLICT') {
        setErrors({ general: '本日の日報は既に存在します' })
      } else {
        setErrors({
          general: data?.error?.message ?? '保存に失敗しました。再度お試しください。',
        })
      }
    } catch {
      setErrors({ general: '通信エラーが発生しました。再度お試しください。' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 訪問記録 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">訪問記録</h2>
          <button
            type="button"
            onClick={addVisit}
            className="rounded border border-blue-500 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            + 訪問を追加
          </button>
        </div>

        <div className="space-y-4">
          {visits.map((v, idx) => {
            const ve = errors.visits?.[idx] ?? {}
            return (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-700">
                    訪問 #{idx + 1}
                  </span>
                  {visits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVisit(idx)}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  {/* 顧客名 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      顧客名 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={v.customer_id}
                      onChange={(e) =>
                        updateVisit(idx, {
                          customer_id: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 bg-white ${
                        ve.customer_id ? 'border-red-400' : 'border-gray-300'
                      }`}
                    >
                      <option value="">顧客を選択してください</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                    {ve.customer_id && (
                      <p className="mt-1 text-xs text-red-600">{ve.customer_id}</p>
                    )}
                  </div>

                  {/* 訪問種別 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      訪問種別 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-6">
                      {(['in_person', 'online', 'phone'] as VisitType[]).map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`visit_type_${idx}`}
                            value={type}
                            checked={v.visit_type === type}
                            onChange={() => updateVisit(idx, { visit_type: type })}
                            className="accent-blue-600"
                          />
                          {VISIT_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                    {ve.visit_type && (
                      <p className="mt-1 text-xs text-red-600">{ve.visit_type}</p>
                    )}
                  </div>

                  {/* 訪問目的 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      訪問目的
                    </label>
                    <input
                      type="text"
                      value={v.purpose}
                      onChange={(e) => updateVisit(idx, { purpose: e.target.value })}
                      className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 ${
                        ve.purpose ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {ve.purpose && (
                      <p className="mt-1 text-xs text-red-600">{ve.purpose}</p>
                    )}
                  </div>

                  {/* 訪問内容 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      訪問内容
                    </label>
                    <textarea
                      value={v.content}
                      onChange={(e) => updateVisit(idx, { content: e.target.value })}
                      rows={3}
                      className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 resize-y ${
                        ve.content ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {ve.content && (
                      <p className="mt-1 text-xs text-red-600">{ve.content}</p>
                    )}
                  </div>

                  {/* 次回アクション */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      次回アクション
                    </label>
                    <textarea
                      value={v.next_action}
                      onChange={(e) => updateVisit(idx, { next_action: e.target.value })}
                      rows={2}
                      className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 resize-y ${
                        ve.next_action ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {ve.next_action && (
                      <p className="mt-1 text-xs text-red-600">{ve.next_action}</p>
                    )}
                  </div>

                  {/* 次回訪問予定日 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      次回訪問予定日
                    </label>
                    <input
                      type="date"
                      value={v.next_visit_date}
                      onChange={(e) =>
                        updateVisit(idx, { next_visit_date: e.target.value })
                      }
                      className={`rounded border px-2 py-1.5 text-sm text-gray-900 ${
                        ve.next_visit_date ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {ve.next_visit_date && (
                      <p className="mt-1 text-xs text-red-600">{ve.next_visit_date}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 課題・相談 */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">課題・相談</h2>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={4}
          placeholder="課題・相談事項を入力してください"
          className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 resize-y ${
            errors.problem ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.problem && (
          <p className="mt-1 text-xs text-red-600">{errors.problem}</p>
        )}
      </section>

      {/* 明日やること */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">明日やること</h2>
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          rows={4}
          placeholder="明日の予定・アクションを入力してください"
          className={`w-full rounded border px-2 py-1.5 text-sm text-gray-900 resize-y ${
            errors.plan ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.plan && (
          <p className="mt-1 text-xs text-red-600">{errors.plan}</p>
        )}
      </section>

      {/* 全般エラー */}
      {errors.general && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errors.general}</p>
        </div>
      )}

      {/* ボタン */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={() => router.push('/reports')}
          disabled={submitting}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={submitting}
          className="rounded border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
        >
          下書き保存
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          提出する
        </button>
      </div>
    </div>
  )
}
