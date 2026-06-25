import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildAuthActionUrl, resolveAppPublicOrigin } from '@/lib/email/public-url'
import { ResendEmailProvider } from '@/lib/email/resend-provider'
import { getTransactionEmailProvider } from '@/lib/email/provider'
import { buildVerificationEmail } from '@/lib/email/templates'

describe('public URL security', () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = 'https://beta.acarindex.com'
  })

  afterEach(() => {
    delete process.env.APP_PUBLIC_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('uses allowlisted https origin', () => {
    expect(resolveAppPublicOrigin()).toBe('https://beta.acarindex.com')
    const url = buildAuthActionUrl('/verify-email', { token: 'abc' })
    expect(url).toBe('https://beta.acarindex.com/verify-email?token=abc')
    expect(url).not.toContain('localhost')
  })

  it('rejects http in production-like URL', () => {
    process.env.APP_PUBLIC_URL = 'http://beta.acarindex.com'
    expect(() => resolveAppPublicOrigin()).toThrow()
  })

  it('rejects open redirect paths', () => {
    expect(() => buildAuthActionUrl('//evil.com')).toThrow()
  })
})

describe('email templates', () => {
  it('includes text and html without tracking', () => {
    const body = buildVerificationEmail({
      to: 'a@example.com',
      verifyUrl: 'https://beta.acarindex.com/verify-email?token=x',
      expiresHours: 24,
    })
    expect(body.text).toContain('AcarIndex')
    expect(body.html).toContain('<p>')
    expect(body.text).not.toContain('password')
  })
})

describe('Resend provider', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.EMAIL_REPLY_TO
    vi.restoreAllMocks()
  })

  it('does not leak API key in error result', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_key_12345'
    process.env.EMAIL_FROM = 'AcarIndex <no-reply@notify.acarindex.com>'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key re_test_secret_key_12345',
    }) as typeof fetch

    const provider = new ResendEmailProvider()
    const r = await provider.send({
      to: 'a@example.com',
      subject: 'test',
      text: 'body',
      html: 'body',
    })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('re_test')
  })

  it('maps 429 without retry', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'no-reply@notify.acarindex.com'
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    globalThis.fetch = fetchMock as typeof fetch

    const provider = new ResendEmailProvider()
    const r = await provider.send({
      to: 'a@example.com',
      subject: 't',
      text: 'b',
      html: 'b',
    })
    expect(r.error).toBe('email_provider_rate_limit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('provider selection', () => {
  afterEach(() => {
    delete process.env.EMAIL_PROVIDER
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    vi.unstubAllEnvs()
    delete process.env.EMAIL_ENV_LABEL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('resend requires credentials without console fallback', () => {
    process.env.EMAIL_PROVIDER = 'resend'
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => getTransactionEmailProvider()).toThrow('RESEND_API_KEY')
  })

  it('production without provider fails closed', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => getTransactionEmailProvider()).toThrow('EMAIL_PROVIDER')
  })
})

describe('webhook fail-closed', () => {
  it('disabled without secret', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const { isResendWebhookEnabled } = await import('@/lib/email/webhook-resend')
    expect(isResendWebhookEnabled()).toBe(false)
  })
})
