import { AlertCircle } from 'lucide-react'

interface CatalogErrorAlertProps {
  title?: string
  message: string
  className?: string
}

/** Veritabanı veya yapılandırma hatası — teknik detay göstermez. */
export function CatalogErrorAlert({
  title = 'Veri yüklenemedi',
  message,
  className = '',
}: CatalogErrorAlertProps) {
  return (
    <div
      className={`rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center ${className}`}
      role="alert"
    >
      <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive/70" aria-hidden="true" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{message}</p>
    </div>
  )
}
