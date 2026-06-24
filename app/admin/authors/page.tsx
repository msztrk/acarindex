import { loadPaginatedAuthors } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedAuthors(sp)
  return <AdminListPage title="Yazarlar" rows={rows} meta={meta} />
}
