import { loadAdminDashboard } from '@/lib/admin/dashboard'
import { Card } from '@/components/ui/card'

export default async function AdminHealthPage() {
  const data = await loadAdminDashboard()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sistem Sağlığı</h1>
      <Card className="p-4 space-y-2">
        <p>API health: {data.health.status}</p>
        <p>Veritabanı: {data.health.database ?? '—'}</p>
      </Card>
    </div>
  )
}
