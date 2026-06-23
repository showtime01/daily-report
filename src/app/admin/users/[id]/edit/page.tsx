'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'

type CurrentUser = {
  id: number
  name: string
  role: string
}

type FieldErrors = {
  name?: string
  email?: string
  password?: string
  role?: string
  department?: string
}

function validatePassword(password: string): string | undefined {
  if (!password) return undefined
  if (password.length < 8) return 'パスワードは8文字以上で入力してください'
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'パスワードには英大文字・英小文字・数字をそれぞれ含めてください'
  }
}

function validate(fields: {
  name: string
  email: string
  password: string
  role: string
  department: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.name) errors.name = '氏名を入力してください'
  else if (fields.name.length > 100) errors.name = '氏名は100文字以内で入力してください'
  if (!fields.email) errors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = '正しいメールアドレス形式で入力してください'
  const pwErr = validatePassword(fields.password)
  if (pwErr) errors.password = pwErr
  if (!fields.role) errors.role = 'ロールを選択してください'
  if (fields.department.length > 100) errors.department = '部署名は100文字以内で入力してください'
  return errors
}

export default function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [error403, setError403] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)

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
    fetch(`/api/v1/users/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) { router.push('/admin/users'); return null }
        return r.json() as Promise<{ name: string; email: string; role: string; department: string | null }>
      })
      .then((data) => {
        if (!data) return
        setName(data.name)
        setEmail(data.email)
        setRole(data.role)
        setDepartment(data.department ?? '')
        setLoadingUser(false)
      })
  }, [currentUser, id, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    const errors = validate({ name, email, password, role, department })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const body: Record<string, string> = { name, email, role }
      if (department) body.department = department
      if (password) body.password = password

      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/admin/users')
      } else if (res.status === 409) {
        setServerError('このメールアドレスは既に使用されています')
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

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">ユーザーが見つかりません</p>
          <button onClick={() => router.push('/admin/users')} className="mt-4 text-sm text-blue-600 underline">
            一覧に戻る
          </button>
        </div>
      </div>
    )
  }

  if (!currentUser || loadingUser) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userName={currentUser.name} showAdminNav />

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-bold text-gray-800 mb-6">ユーザー編集</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {serverError && (
            <p className="mb-4 rounded bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
                <span className="ml-2 text-xs font-normal text-gray-500">（変更する場合のみ入力）</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ロール <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6">
                {[
                  { value: 'sales', label: '営業' },
                  { value: 'manager', label: '上長' },
                  { value: 'admin', label: '管理者' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={role === opt.value}
                      onChange={(e) => setRole(e.target.value)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
              {fieldErrors.role && <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.department ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors.department && <p className="mt-1 text-xs text-red-600">{fieldErrors.department}</p>}
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
                onClick={() => router.push('/admin/users')}
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
