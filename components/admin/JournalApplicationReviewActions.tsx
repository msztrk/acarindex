'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContentApplicationStatus } from '@prisma/client'

type Props = {
  contentApplicationId: string
  status: ContentApplicationStatus
}

type ActionKey = 'precheck' | 'under_review' | 'request_revision' | 'reject' | 'approve'

const ACTION_LABELS: Record<ActionKey, string> = {
  precheck: 'Ön kontrol',
  under_review: 'İncelemeye al',
  request_revision: 'Düzeltme iste',
  reject: 'Reddet',
  approve: 'Onayla',
}

function canPrecheck(status: ContentApplicationStatus) {
  return status === 'submitted'
}

function canUnderReview(status: ContentApplicationStatus) {
  return status === 'submitted' || status === 'precheck'
}

function canRequestRevision(status: ContentApplicationStatus) {
  return status === 'submitted' || status === 'precheck' || status === 'under_review'
}

function canReject(status: ContentApplicationStatus) {
  return (
    status === 'submitted' ||
    status === 'precheck' ||
    status === 'under_review' ||
    status === 'revision_requested'
  )
}

function canApprove(status: ContentApplicationStatus) {
  return status === 'submitted' || status === 'precheck' || status === 'under_review'
}

export function JournalApplicationReviewActions({ contentApplicationId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<ActionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [showNoteFor, setShowNoteFor] = useState<ActionKey | null>(null)

  async function submit(action: ActionKey, requiresNote = false) {
    if (requiresNote && !note.trim()) {
      setError('Not alanı zorunludur.')
      return
    }

    setError(null)
    setLoading(action)
    try {
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      const res = await fetch(`/api/admin/applications/journal/${contentApplicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          action,
          note: requiresNote ? note.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'İşlem başarısız.')
        return
      }
      setNote('')
      setShowNoteFor(null)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(null)
    }
  }

  function renderAction(action: ActionKey, enabled: boolean, requiresNote = false) {
    if (!enabled) return null

    const isNoteAction = requiresNote
    const showingNote = showNoteFor === action

    return (
      <div key={action} className="flex flex-col gap-1">
        {!showingNote ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => {
              if (isNoteAction) {
                setShowNoteFor(action)
                setError(null)
              } else {
                submit(action)
              }
            }}
            className={
              action === 'approve'
                ? 'rounded border border-green-600/40 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950/30'
                : action === 'reject'
                  ? 'rounded border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50'
                  : 'rounded border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50'
            }
          >
            {loading === action ? '…' : ACTION_LABELS[action]}
          </button>
        ) : (
          <div className="space-y-2 rounded border p-3">
            <label className="text-xs font-medium text-muted-foreground">
              {action === 'reject' ? 'Red gerekçesi' : 'Düzeltme notu'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded border bg-background px-2 py-1 text-sm"
              placeholder="Zorunlu not…"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => submit(action, true)}
                className="rounded border border-primary/40 px-2 py-1 text-sm text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                {loading === action ? '…' : 'Gönder'}
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => {
                  setShowNoteFor(null)
                  setNote('')
                  setError(null)
                }}
                className="rounded border px-2 py-1 text-sm hover:bg-muted/50 disabled:opacity-50"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (status === 'approved' || status === 'rejected' || status === 'cancelled') {
    return (
      <p className="text-sm text-muted-foreground">Bu başvuru için işlem yapılamaz ({status}).</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {renderAction('precheck', canPrecheck(status))}
        {renderAction('under_review', canUnderReview(status))}
        {renderAction('request_revision', canRequestRevision(status), true)}
        {renderAction('reject', canReject(status), true)}
        {renderAction('approve', canApprove(status))}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
