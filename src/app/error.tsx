'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  const isNotFound = error.message?.includes('404') || error.message?.includes('NOT_FOUND')
  const isForbidden = error.message?.includes('403') || error.message?.includes('FORBIDDEN')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
        {isForbidden ? (
          <>
            <p className="text-4xl mb-4">🔒</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h1>
            <p className="text-sm text-gray-500 mb-6">
              このページを表示する権限がありません。
            </p>
          </>
        ) : isNotFound ? (
          <>
            <p className="text-4xl mb-4">🔍</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">ページが見つかりません</h1>
            <p className="text-sm text-gray-500 mb-6">
              お探しのページは存在しないか、削除された可能性があります。
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl mb-4">⚠️</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h1>
            <p className="text-sm text-gray-500 mb-6">
              予期しないエラーが発生しました。しばらくしてから再度お試しください。
            </p>
          </>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            再試行
          </button>
          <button
            onClick={() => router.push('/')}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            トップへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
