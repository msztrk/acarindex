/**
 * Resend delivery webhook — imza doğrulama (Svix). Secret yoksa endpoint fail-closed.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

export function isResendWebhookEnabled(): boolean {
  return Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim())
}

export function readWebhookSecret(): string | null {
  const s = process.env.RESEND_WEBHOOK_SECRET?.trim()
  return s || null
}

export function assertWebhookBodySize(contentLength: number | null): void {
  if (contentLength != null && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    throw new Error('body_too_large')
  }
}

/** Svix imza doğrulama (Resend webhook). */
export function verifyResendWebhookSignature(
  rawBody: string,
  headers: {
    svixId?: string | null
    svixTimestamp?: string | null
    svixSignature?: string | null
  },
  secret: string,
): boolean {
  const msgId = headers.svixId?.trim()
  const timestamp = headers.svixTimestamp?.trim()
  const signatureHeader = headers.svixSignature?.trim()
  if (!msgId || !timestamp || !signatureHeader) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const ageSec = Math.abs(Date.now() / 1000 - ts)
  if (ageSec > 300) return false

  const secretBytes = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const key = Buffer.from(secretBytes, 'base64')
  const signed = `${msgId}.${timestamp}.${rawBody}`
  const expected = createHmac('sha256', key).update(signed).digest('base64')

  const parts = signatureHeader.split(' ')
  for (const part of parts) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    try {
      const a = Buffer.from(sig, 'base64')
      const b = Buffer.from(expected, 'base64')
      if (a.length === b.length && timingSafeEqual(a, b)) return true
    } catch {
      continue
    }
  }
  return false
}

export type ResendWebhookEventType =
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained'
  | 'email.delivery_delayed'
  | 'email.failed'

export interface ResendWebhookPayload {
  type: string
  data?: { email_id?: string }
}

/** Gelecek faz — idempotent işleme noktası. */
export async function handleResendWebhookEvent(_payload: ResendWebhookPayload): Promise<void> {
  // Bu sprintte kullanıcı davranışına bağlanmıyor.
}
