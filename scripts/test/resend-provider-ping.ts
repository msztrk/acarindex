#!/usr/bin/env npx tsx
/** Zararsız Resend bağlantı testi — secret/token loglanmaz. */
import { ResendEmailProvider } from '@/lib/email/resend-provider'

const to = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim()
if (!to) {
  console.error('ACAR_BETA_MAIL_TEST_EMAIL gerekli')
  process.exit(1)
}

if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== 'resend') {
  console.error('EMAIL_PROVIDER=resend gerekli')
  process.exit(1)
}

const provider = new ResendEmailProvider()
const result = await provider.send({
  to,
  subject: 'AcarIndex — Beta provider bağlantı testi',
  text: [
    'Bu mesaj AcarIndex beta ortamı Resend bağlantı testidir.',
    'Herhangi bir işlem yapmanız gerekmez.',
    'Sorularınız için yanıt verebilirsiniz.',
  ].join('\n'),
  html: '<p>Bu mesaj AcarIndex beta ortamı Resend bağlantı testidir. Herhangi bir işlem yapmanız gerekmez.</p>',
})

if (!result.ok) {
  console.error('provider_send_failed', result.error ?? 'unknown')
  process.exit(1)
}

console.log('provider_ping_accepted')
