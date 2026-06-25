import type { EmailMessage, TransactionEmailProvider } from '@/lib/email/types'
import { isProductionEnv } from '@/lib/auth/config'

function envLabel(): string {
  if (isProductionEnv()) return 'PRODUCTION'
  return process.env.EMAIL_ENV_LABEL?.trim() || 'NON-PRODUCTION'
}

export class ConsoleEmailProvider implements TransactionEmailProvider {
  async send(message: EmailMessage): Promise<{ ok: boolean; error?: string }> {
    const label = envLabel()
    const safe = {
      env: label,
      to: message.to,
      subject: message.subject,
      textPreview: message.text.slice(0, 200),
    }
    console.info('[acarindex-email]', JSON.stringify(safe))
    return { ok: true }
  }
}

export function getTransactionEmailProvider(): TransactionEmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  if (provider && provider !== 'console' && provider !== 'log') {
    // Gerçek sağlayıcı credential onayı sonrası adapter eklenecek
    throw new Error('EMAIL_PROVIDER yapılandırılmadı — canlı gönderim kapalı.')
  }
  return new ConsoleEmailProvider()
}
