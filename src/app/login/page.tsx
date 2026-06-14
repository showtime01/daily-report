'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FieldErrors = {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email) {
    errors.email = 'メールアドレスを入力してください'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = '正しいメールアドレス形式で入力してください'
  }
  if (!password) {
    errors.password = 'パスワードを入力してください'
  } else if (password.length < 8) {
    errors.password = 'パスワードは8文字以上で入力してください'
  }
  return errors
}

const ROLE_REDIRECT: Record<string, string> = {
  sales: '/reports',
  manager: '/manager/reports',
  admin: '/admin/users',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    const errors = validate(email, password)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        const user = await res.json()
        const redirect = ROLE_REDIRECT[user.role] ?? '/login'
        router.push(redirect)
      } else {
        setServerError('メールアドレスまたはパスワードが正しくありません')
      }
    } catch {
      setServerError('通信エラーが発生しました。しばらく経ってから再試行してください')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">
          営業日報システム
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          {serverError && (
            <p className="mb-4 rounded bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
              {serverError}
            </p>
          )}

          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.email
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded border px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.password
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
