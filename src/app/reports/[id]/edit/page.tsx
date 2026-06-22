'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import ReportForm, { type VisitRecordForm } from '@/components/ReportForm'

type User = { id: number; name: string; role: string }
type Customer = { id: number; company_name: string }
type VisitRecordApi = {
  id: number
  customer_id: number
  visit_type: 'in_person' | 'online' | 'phone'
  purpose: string | null
  content: string | null
  next_action: string | null
  next_visit_date: string | null
}
type ReportDetail = {
  id: number
  report_date: string
  status: string
  problem: string | null
  plan: string | null
  visit_records: VisitRecordApi[]
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = Number(params.id)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function init() {
      const meRes = await fetch('/api/v1/auth/me')
      if (!meRes.ok) {
        router.push('/login')
        return
      }
      const me = (await meRes.json()) as User
      if (me.role !== 'sales') {
        router.push('/login')
        return
      }
      setCurrentUser(me)

      const [reportRes, custRes] = await Promise.all([
        fetch(`/api/v1/daily-reports/${reportId}`),
        fetch('/api/v1/customers'),
      ])

      if (!reportRes.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const reportData = (await reportRes.json()) as ReportDetail
      if (reportData.status !== 'draft') {
        router.push('/reports')
        return
      }

      setReport(reportData)
      if (custRes.ok) {
        setCustomers((await custRes.json()) as Customer[])
      }
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

  const initialVisits: VisitRecordForm[] = report.visit_records.map((vr) => ({
    customer_id: vr.customer_id,
    visit_type: vr.visit_type,
    purpose: vr.purpose ?? '',
    content: vr.content ?? '',
    next_action: vr.next_action ?? '',
    next_visit_date: vr.next_visit_date ?? '',
  }))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">日報編集</h1>
          <p className="text-sm text-gray-500 mt-1">
            報告日: {formatDate(report.report_date)}
          </p>
        </div>
        <ReportForm
          reportDate={report.report_date}
          reportId={report.id}
          initialProblem={report.problem ?? ''}
          initialPlan={report.plan ?? ''}
          initialVisits={initialVisits}
          customers={customers}
        />
      </main>
    </div>
  )
}
