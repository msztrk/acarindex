import { loadAdminDashboard } from '@/lib/admin/dashboard'
import { Card } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  const data = await loadAdminDashboard()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Genel Bakış</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(data.counts).map(([key, value]) => (
          <Card key={key} className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{key}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-2">
          <h2 className="font-medium">Veri kalite özeti</h2>
          <ul className="text-sm space-y-1">
            <li>Duplicate slug: {data.quality.duplicateSlugs}</li>
            <li>Orphan makale: {data.quality.orphanArticles}</li>
            <li>Orphan sayı: {data.quality.orphanIssues}</li>
            <li>Başarısız ETL: {data.quality.failedEtlRuns}</li>
          </ul>
        </Card>
        <Card className="p-4 space-y-2">
          <h2 className="font-medium">Healthcheck</h2>
          <p className="text-sm">Durum: {data.health.status}</p>
          <p className="text-sm">Veritabanı: {data.health.database ?? '—'}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Son ETL işlemleri</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Run</th>
              <th>Script</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Hata</th>
            </tr>
          </thead>
          <tbody>
            {data.recentEtlRuns.map((r) => (
              <tr key={r.runId} className="border-b border-muted/50">
                <td className="py-2 font-mono text-xs">{r.runId}</td>
                <td>{r.script}</td>
                <td>{r.mode}</td>
                <td>{r.status}</td>
                <td>{r.rowsError}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
