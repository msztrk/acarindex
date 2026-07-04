import Link from 'next/link'
import { requireUserAuth } from '@/lib/auth/guards'
import { listUnifiedUserApplications } from '@/lib/applications/list-unified'
import { CONTENT_KIND_LABELS, MEMBERSHIP_KIND_LABELS } from '@/lib/applications/types'
import type { ApplicationListKind } from '@/lib/applications/types'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Başvuru ve Katkı Merkezi | Hesabım' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  in_review: 'İncelemede',
  revision_requested: 'Düzeltme istendi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
}

function kindLabel(kind: ApplicationListKind): string {
  if (kind in CONTENT_KIND_LABELS) {
    return CONTENT_KIND_LABELS[kind as keyof typeof CONTENT_KIND_LABELS]
  }
  if (kind in MEMBERSHIP_KIND_LABELS) {
    return MEMBERSHIP_KIND_LABELS[kind as keyof typeof MEMBERSHIP_KIND_LABELS]
  }
  return kind
}

export default async function BasvurularPage() {
  const session = await requireUserAuth()
  const items = await listUnifiedUserApplications(session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Başvuru ve Katkı Merkezi</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Yeni dergi, duyuru, veri düzeltme ve yetki başvurularınız.
          </p>
        </div>
        <Link
          href="/hesabim/basvurular/yeni"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Yeni başvuru
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/editor/basvuru" className="text-primary hover:underline">
          Dergi yetkilisi başvurusu
        </Link>
        <Link href="/kurum/basvuru" className="text-primary hover:underline">
          Kurum yöneticisi başvurusu
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Henüz başvurunuz yok.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Başlık</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.source}-${item.id}`} className="border-b">
                  <td className="px-3 py-2">{kindLabel(item.kind)}</td>
                  <td className="px-3 py-2">
                    <Link href={item.detailUrl} className="text-primary hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {STATUS_LABELS[item.displayStatus] ?? item.displayStatus}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleString('tr-TR')}
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
