import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { requireInstitutionPanelSession } from '@/lib/auth/panel-guards'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ institutionId: string }>
}) {
  const { institutionId } = await params
  const inst = await prisma.institution.findUnique({
    where: { id: BigInt(institutionId) },
    select: { nameTr: true },
  })
  return {
    title: inst?.nameTr ? `${inst.nameTr} — Kurum | AcarIndex` : 'Kurum Paneli | AcarIndex',
  }
}

export default async function KurumDetailPage({
  params,
}: {
  params: Promise<{ institutionId: string }>
}) {
  const { institutionId } = await params
  const ctx = await requireInstitutionPanelSession(institutionId)

  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
    select: { nameTr: true, slug: true, website: true, emailDomain: true },
  })

  const canManage = ctx.membership.role === 'institution_manager'

  return (
    <div className="space-y-8">
      <div>
        <Link href="/kurum" className="text-sm text-primary hover:underline">
          ← Tüm kurumlar
        </Link>
        <h2 className="mt-2 text-xl font-semibold">
          {institution?.nameTr ?? `Kurum #${institutionId}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Rol:{' '}
          {ctx.membership.role === 'institution_manager'
            ? 'Kurum yöneticisi'
            : 'Kurum görüntüleyici'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">Web sitesi</p>
          <p className="text-lg font-medium break-all">{institution?.website ?? '—'}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">E-posta alanı</p>
          <p className="text-lg font-medium">{institution?.emailDomain ?? '—'}</p>
        </div>
      </div>

      {canManage ? (
        <section className="rounded-md border p-4 bg-muted/30">
          <h3 className="font-medium mb-2">Kurum yönetimi (yakında)</h3>
          <p className="text-sm text-muted-foreground">
            Üye yönetimi ve kurum profili düzenleme bu panelden yapılacak. Kritik alan değişiklikleri
            admin onayı gerektirir.
          </p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Bu kurum için yalnızca görüntüleme yetkiniz var.
        </p>
      )}
    </div>
  )
}
