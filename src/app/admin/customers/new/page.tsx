'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'

type CurrentUser = {
  id: number
  name: string
  role: string
}

type SalesUser = {
  id: number
  name: string
  department: string | null
}

type SalesEntry = {
  user_id: number
  user_name: string
  department: string | null
  assigned_at: string
}

type FieldErrors = {
  company_name?: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  industry?: string
}

function validatePhone(phone: string): string | undefined {
  if (!phone) return undefined
  if (!/^[\d-]+$/.test(phone) || phone.replace(/-/g, '').length < 10) {
    return '正しい電話番号形式で入力してください（例：03-1234-5678）'
  }
}

function validate(fields: {
  company_name: string
  contact_name: string
  phone: string
  email: string
  address: string
  industry: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.company_name) errors.company_name = '企業名を入力してください'
  else if (fields.company_name.length > 200) errors.company_name = '企業名は200文字以内で入力してください'
  if (!fields.contact_name) errors.contact_name = '担当者名を入力してください'
  else if (fields.contact_name.length > 100) errors.contact_name = '担当者名は100文字以内で入力してください'
  const phoneErr = validatePhone(fields.phone)
  if (phoneErr) errors.phone = phoneErr
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = '正しいメールアドレス形式で入力してください'
  if (fields.address.length > 300) errors.address = '住所は300文字以内で入力してください'
  if (fields.industry.length > 100) errors.industry = '業種は100文字以内で入力してください'
  return errors
}

export default function AdminCustomerNewPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [error403, setError403] = useState(false)
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])

  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [industry, setIndustry] = useState('')
  const [salesList, setSalesList] = useState<SalesEntry[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assignedAt, setAssignedAt] = useState('')
  const [addSalesError, setAddSalesError] = useState('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    fetch('/api/v1/users?role=sales')
      .then((r) => r.ok ? r.json() as Promise<SalesUser[]> : [])
      .then((data) => setSalesUsers(Array.isArray(data) ? data : []))
  }, [currentUser])

  function handleAddSales() {
    setAddSalesError('')
    if (!selectedUserId) { setAddSalesError('担当営業を選択してください'); return }
    if (!assignedAt) { setAddSalesError('担当開始日を入力してください'); return }
    const userId = Number(selectedUserId)
    if (salesList.some((s) => s.user_id === userId)) {
      setAddSalesError('この担当者は既に追加されています')
      return
    }
    const user = salesUsers.find((u) => u.id === userId)
    if (!user) return
    setSalesList((prev) => [...prev, { user_id: userId, user_name: user.name, department: user.department, assigned_at: assignedAt }])
    setSelectedUserId('')
    setAssignedAt('')
  }

  function handleRemoveSales(userId: number) {
    setSalesList((prev) => prev.filter((s) => s.user_id !== userId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    const errors = validate({ company_name: companyName, contact_name: contactName, phone, email, address, industry })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        company_name: companyName,
        contact_name: contactName,
      }
      if (phone) body.phone = phone
      if (email) body.email = email
      if (address) body.address = address
      if (industry) body.industry = industry
      if (salesList.length > 0) {
        body.sales = salesList.map((s) => ({ user_id: s.user_id, assigned_at: s.assigned_at }))
      }

      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/admin/customers')
      } else {
        const data = await res.json() as { error?: { details?: Array<{ field: string; message: string }> } }
        const details = data.error?.details ?? []
        const fe: FieldErrors = {}
        details.forEach((d) => { (fe as Record<string, string>)[d.field] = d.message })
        if (Object.keys(fe).length > 0) setFieldErrors(fe)
        else setServerError('保存に失敗しました')
      }
    } catch {
      setServerError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
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

  const availableSalesUsers = salesUsers.filter((u) => !salesList.some((s) => s.user_id === u.id))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} showAdminNav />

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-bold text-gray-800 mb-6">顧客登録</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {serverError && (
            <p className="mb-4 rounded bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                企業名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.company_name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.company_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.company_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                担当者名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.contact_name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.contact_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03-1234-5678"
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.address ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.address && <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">業種</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.industry ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.industry && <p className="mt-1 text-xs text-red-600">{fieldErrors.industry}</p>}
            </div>

            {/* 担当営業 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">担当営業</label>

              {salesList.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {salesList.map((s) => (
                    <li key={s.user_id} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      <span className="text-gray-800">
                        {s.user_name}
                        {s.department && <span className="ml-1 text-gray-500">（{s.department}）</span>}
                        <span className="ml-2 text-gray-500">担当開始日: {s.assigned_at}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSales(s.user_id)}
                        className="ml-3 text-xs text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 items-end">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">担当者を選択</option>
                  {availableSalesUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.department ? `（${u.department}）` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={assignedAt}
                  onChange={(e) => setAssignedAt(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={handleAddSales}
                  className="rounded border border-blue-500 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  + 追加
                </button>
              </div>
              {addSalesError && <p className="mt-1 text-xs text-red-600">{addSalesError}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '保存中...' : '保存する'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/customers')}
                className="rounded border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
