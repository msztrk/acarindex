import type {
  EmailService,
  PasswordResetEmailParams,
  VerificationEmailParams,
} from '@/lib/email/types'
import { getTransactionEmailProvider } from '@/lib/email/provider'

function supportLine(): string {
  const reply = process.env.EMAIL_REPLY_TO?.trim()
  if (reply) return `Sorularınız için: ${reply}`
  return 'Sorularınız için: https://beta.acarindex.com/contact'
}

function wrapBody(title: string, paragraphs: string[]): { text: string; html: string } {
  const all = [...paragraphs, supportLine()]
  const text = [`AcarIndex — ${title}`, '', ...all, '', '— AcarIndex'].join('\n')
  const html = [
    `<p><strong>AcarIndex</strong> — ${title}</p>`,
    ...all.map((p) => `<p>${p}</p>`),
    '<p>— AcarIndex</p>',
  ].join('')
  return { text, html }
}

export function buildVerificationEmail(params: VerificationEmailParams) {
  const { verifyUrl, expiresHours } = params
  return wrapBody('E-posta doğrulama', [
    'Hesabınızı doğrulamak için aşağıdaki bağlantıyı kullanın:',
    verifyUrl,
    `Bağlantı ${expiresHours} saat geçerlidir.`,
    'Bu işlemi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.',
  ])
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams) {
  const { resetUrl, expiresMinutes } = params
  return wrapBody('Parola sıfırlama', [
    'Parolanızı sıfırlamak için aşağıdaki bağlantıyı kullanın:',
    resetUrl,
    `Bağlantı ${expiresMinutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir.`,
    'Bu talebi siz yapmadıysanız parolanızı değiştirmeyin ve hesabınızı kontrol edin.',
  ])
}

export function buildPasswordChangedEmail() {
  return wrapBody('Parola değiştirildi', [
    'Hesabınızın parolası değiştirildi.',
    'Bu işlemi siz yapmadıysanız hemen parolanızı sıfırlayın ve destek ile iletişime geçin.',
  ])
}

export function buildDeletionRequestEmail(scheduledDate: string) {
  return wrapBody('Hesap silme talebi', [
    'Hesabınızın silinmesi için talep alındı.',
    `Planlanan işlem tarihi: ${scheduledDate}`,
    'Bu süre içinde giriş yaparak talebi iptal edebilirsiniz.',
  ])
}

export function buildNewLoginEmail(when: string, deviceHint: string) {
  return wrapBody('Yeni oturum', [
    `Hesabınıza yeni bir oturum açıldı: ${when}`,
    `Cihaz: ${deviceHint}`,
    'Bu siz değilseniz parolanızı değiştirin ve diğer oturumları kapatın.',
  ])
}

export function createEmailService(): EmailService {
  const provider = getTransactionEmailProvider()

  return {
    async sendVerificationEmail(params) {
      const body = buildVerificationEmail(params)
      const r = await provider.send({
        to: params.to,
        subject: 'AcarIndex — E-posta doğrulama',
        ...body,
      })
      return { ok: r.ok }
    },
    async sendPasswordResetEmail(params) {
      const body = buildPasswordResetEmail(params)
      const r = await provider.send({
        to: params.to,
        subject: 'AcarIndex — Parola sıfırlama',
        ...body,
      })
      return { ok: r.ok }
    },
    async sendSecurityNotification(params) {
      const body = wrapBody(params.subject, [params.body])
      const r = await provider.send({
        to: params.to,
        subject: `AcarIndex — ${params.subject}`,
        ...body,
      })
      return { ok: r.ok }
    },
  }
}
