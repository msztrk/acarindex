import type { TransactionEmailProvider } from '@/lib/email/types'
import { isProductionEnv } from '@/lib/auth/config'
import { ConsoleEmailProvider } from '@/lib/email/console-provider'
import { ResendEmailProvider } from '@/lib/email/resend-provider'

function isRehearsalConsoleAllowed(): boolean {
  const label = process.env.EMAIL_ENV_LABEL?.trim().toLowerCase()
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || ''
  return label === 'rehearsal' || site.includes('127.0.0.1:3001')
}

export function getTransactionEmailProvider(): TransactionEmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()

  if (provider === 'resend') {
    return new ResendEmailProvider()
  }

  if (provider === 'console' || provider === 'log') {
    if (isProductionEnv() && !isRehearsalConsoleAllowed()) {
      throw new Error('Console e-posta provider production ortamında kullanılamaz.')
    }
    return new ConsoleEmailProvider()
  }

  if (!provider) {
    if (isProductionEnv()) {
      throw new Error('EMAIL_PROVIDER yapılandırılmadı — canlı gönderim kapalı.')
    }
    return new ConsoleEmailProvider()
  }

  throw new Error('EMAIL_PROVIDER tanınmıyor.')
}
