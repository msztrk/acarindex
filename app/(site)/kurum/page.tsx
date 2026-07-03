import Link from 'next/link'
import { listApprovedInstitutionMemberships } from '@/lib/auth/authorization'
import { requireUserAuth } from '@/lib/auth/guards'
import { listMembershipApplicationsForUser } from '@/lib/membership-applications/service'

export const metadata = { title: 'Kurum Paneli | AcarIndex' }

export default async function KurumPanelPage() {
  const session = await requireUserAuth()
  const [memberships, applications] = await Promise.all([
    listApprovedInstitutionMemberships(session.user.id),
    listMembershipApplicationsForUser(session.user.id),
  ])

  const pendingApps = applications.filter(
    (a) => a.type === 'institution_manager' && a.status === 'pending',
  )

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Yetkili olduğunuz kurumlar</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz onaylı kurum üyeliğiniz yok.{' '}
            <Link href="/kurum/basvuru" className="text-primary hover:underline">
              Kurum yöneticisi başvurusu yapın
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{m.institution.nameTr}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.role === 'institution_manager' ? 'Kurum yöneticisi' : 'Kurum görüntüleyici'}
                  </p>
                </div>
                <Link href={`/kurum/${m.institutionId}`} className="text-sm text-primary hover:underline">
                  Panel
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingApps.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Bekleyen başvurular</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {pendingApps.map((a) => (
              <li key={a.id}>
                Kurum #{a.institutionId?.toString()} — inceleme bekliyor
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
