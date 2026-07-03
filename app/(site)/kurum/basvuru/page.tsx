'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InstitutionApplicationPage() {
  const router = useRouter()
  const [institutionId, setInstitutionId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      const res = await fetch('/api/membership-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          type: 'institution_manager',
          institutionId,
          payload: note.trim() ? { note: note.trim() } : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Başvuru gönderilemedi.')
        return
      }
      router.push('/kurum')
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-2">Kurum yöneticisi başvurusu</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Kurum ID numarasını girin. Başvurunuz admin tarafından incelendikten sonra onaylanır.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="institutionId" className="block text-sm font-medium mb-1">
            Kurum ID
          </label>
          <input
            id="institutionId"
            type="text"
            inputMode="numeric"
            required
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="örn. 7"
          />
        </div>
        <div>
          <label htmlFor="note" className="block text-sm font-medium mb-1">
            Açıklama (isteğe bağlı)
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
        </button>
      </form>
    </div>
  )
}
