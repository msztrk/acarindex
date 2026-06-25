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
      textLength: message.text.length,
    }
    console.info('[acarindex-email]', JSON.stringify(safe))
    return { ok: true }
  }
}
