import type { EmailMessage, TransactionEmailProvider } from '@/lib/email/types'

const RESEND_API_URL = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 15000

function safeProviderError(status: number): string {
  if (status === 401 || status === 403) return 'email_provider_auth'
  if (status === 429) return 'email_provider_rate_limit'
  if (status >= 500) return 'email_provider_unavailable'
  return 'email_provider_error'
}

export class ResendEmailProvider implements TransactionEmailProvider {
  private readonly apiKey: string
  private readonly from: string
  private readonly replyTo?: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.EMAIL_FROM?.trim()
    if (!apiKey) {
      throw new Error('RESEND_API_KEY yapılandırılmadı.')
    }
    if (!from) {
      throw new Error('EMAIL_FROM yapılandırılmadı.')
    }
    this.apiKey = apiKey
    this.from = from
    const reply = process.env.EMAIL_REPLY_TO?.trim()
    this.replyTo = reply || undefined
  }

  async send(message: EmailMessage): Promise<{ ok: boolean; error?: string }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

    try {
      const body: Record<string, unknown> = {
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }
      if (this.replyTo) {
        body.reply_to = this.replyTo
      }

      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        return { ok: false, error: safeProviderError(res.status) }
      }

      return { ok: true }
    } catch {
      return { ok: false, error: 'email_provider_unavailable' }
    } finally {
      clearTimeout(timer)
    }
  }
}
