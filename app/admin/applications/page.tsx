import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import { listAdminContentApplicationQueue } from '@/lib/applications/service'
import { CONTENT_KIND_LABELS } from '@/lib/applications/types'
import { CONTENT_STATUS_LABELS } from '@/lib/journal-applications/admin-service'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage() {
  await requireAdminPermissionGuard('review_content_applications')
  const rows = await listAdminContentApplicationQueue()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">İçerik başvuruları</h1>
      <p className="text-sm text-muted-foreground">
        Yeni dergi başvuruları için detay inceleme sayfasına gidin.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/admin/membership-applications" className="text-primary hover:underline">
          Üyelik başvuruları
        </Link>
        <Link href="/admin/change-requests" className="text-primary hover:underline">
          Değişiklik talepleri
        </Link>
      </div>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Bekleyen içerik başvurusu yok.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Başlık</th>
                <th className="px-3 py-2 font-medium">Başvuran</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Gönderim</th>
                <th className="px-3 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{CONTENT_KIND_LABELS[r.kind]}</td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2">{r.user.email}</td>
                  <td className="px-3 py-2">
                    {CONTENT_STATUS_LABELS[r.status as keyof typeof CONTENT_STATUS_LABELS] ?? r.status}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.submittedAt?.toLocaleString('tr-TR') ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.kind === 'new_journal' ? (
                      <Link
                        href={`/admin/applications/journal/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        İncele
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
