import { STATUS_LABEL } from '@/lib/constants'

type Status = 'draft' | 'submitted' | 'reviewed'

const LABEL: Record<Status, string> = STATUS_LABEL as Record<Status, string>

const COLOR: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-green-100 text-green-700',
}

export default function StatusBadge({ status }: { status: string }) {
  const s = status as Status
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${COLOR[s] ?? 'bg-gray-100 text-gray-700'}`}>
      {LABEL[s] ?? status}
    </span>
  )
}
