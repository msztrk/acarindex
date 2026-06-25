import { NextResponse } from 'next/server'
import {
  assertWebhookBodySize,
  handleResendWebhookEvent,
  isResendWebhookEnabled,
  readWebhookSecret,
  verifyResendWebhookSignature,
  type ResendWebhookPayload,
} from '@/lib/email/webhook-resend'

export async function POST(request: Request) {
  if (!isResendWebhookEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const secret = readWebhookSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contentLength = request.headers.get('content-length')
  assertWebhookBodySize(contentLength ? Number(contentLength) : null)

  const rawBody = await request.text()
  if (rawBody.length > 256 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const valid = verifyResendWebhookSignature(rawBody, {
    svixId: request.headers.get('svix-id'),
    svixTimestamp: request.headers.get('svix-timestamp'),
    svixSignature: request.headers.get('svix-signature'),
  }, secret)

  if (!valid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await handleResendWebhookEvent(payload)
  return NextResponse.json({ ok: true })
}
