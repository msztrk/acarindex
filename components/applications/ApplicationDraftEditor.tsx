'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PrivateContact = {
  contactName?: string | null
  contactRole?: string | null
  contactEmail?: string | null
  workPhone?: string | null
  mobilePhone?: string | null
} | null

type Props = {
  applicationId: string
  initialTitle: string
  initialDraftPayload: Record<string, unknown>
  initialPrivateContact: PrivateContact
}

export function ApplicationDraftEditor({
  applicationId,
  initialTitle,
  initialDraftPayload,
  initialPrivateContact,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [note, setNote] = useState(String(initialDraftPayload.note ?? ''))
  const [contactName, setContactName] = useState(initialPrivateContact?.contactName ?? '')
  const [contactEmail, setContactEmail] = useState(initialPrivateContact?.contactEmail ?? '')
  const [workPhone, setWorkPhone] = useState(initialPrivateContact?.workPhone ?? '')
  const [loading, setLoading] = useState<'save' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function getCsrf() {
    const res = await fetch('/api/auth/csrf')
    const data = await res.json()
    return data.csrfToken as string
  }

  async function saveDraft() {
    setError(null)
    setMessage(null)
    setLoading('save')
    try {
      const csrfToken = await getCsrf()
      await fetch(`/api/applications/${applicationId}/private-contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          workPhone: workPhone || null,
        }),
      })
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          title,
          draftPayload: { note: note.trim() || null },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Kaydedilemedi.')
        return
      }
      setMessage('Taslak kaydedildi.')
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(null)
    }
  }

  async function submitApplication() {
    setError(null)
    setMessage(null)
    setLoading('submit')
    try {
      await saveDraftInternal()
      const csrfToken = await getCsrf()
      const res = await fetch(`/api/applications/${applicationId}/submit`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gönderilemedi.')
        return
      }
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(null)
    }
  }

  async function saveDraftInternal() {
    const csrfToken = await getCsrf()
    await fetch(`/api/applications/${applicationId}/private-contact`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        workPhone: workPhone || null,
      }),
    })
    await fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        title,
        draftPayload: { note: note.trim() || null },
      }),
    })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="font-medium">Taslak düzenleme</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Başlık</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Not (Faz A placeholder)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <fieldset className="space-y-2 border-t pt-4">
        <legend className="text-sm font-medium">Gizli iletişim (yalnızca siz ve admin)</legend>
        <input
          type="text"
          placeholder="İletişim adı"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="E-posta"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="tel"
          placeholder="İş telefonu"
          value={workPhone}
          onChange={(e) => setWorkPhone(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void saveDraft()}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading === 'save' ? '…' : 'Kaydet'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void submitApplication()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {loading === 'submit' ? '…' : 'Gönder'}
        </button>
      </div>
    </div>
  )
}
