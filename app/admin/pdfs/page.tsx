import { loadPaginatedPdfs } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminPdfsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedPdfs(sp)
  return <AdminListPage title="PDF Kayıtları" rows={rows} meta={meta} />
}
