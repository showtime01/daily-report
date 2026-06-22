'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import ReportForm from '@/components/ReportForm'

type User = { id: number; name: string; role: string }
type Customer = { id: number; company_name: string }

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

export default function NewReportPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

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

      const custRes = await fetch('/api/v1/customers')
      if (custRes.ok) {
        setCustomers((await custRes.json()) as Customer[])
      }

      setLoading(false)
    }
    init()
  }, [router])

  if (loading || !currentUser) return null

  const today = todayStr()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">日報作成</h1>
          <p className="text-sm text-gray-500 mt-1">報告日: {formatDate(today)}</p>
        </div>
        <ReportForm
          reportDate={today}
          initialProblem=""
          initialPlan=""
          initialVisits={[]}
          customers={customers}
        />
      </main>
    </div>
  )
}
