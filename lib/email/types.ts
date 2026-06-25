export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

export interface TransactionEmailProvider {
  send(message: EmailMessage): Promise<{ ok: boolean; error?: string }>
}

export interface VerificationEmailParams {
  to: string
  verifyUrl: string
  expiresHours: number
}

export interface PasswordResetEmailParams {
  to: string
  resetUrl: string
  expiresMinutes: number
}

export interface SecurityNotificationParams {
  to: string
  subject: string
  body: string
}

export interface EmailService {
  sendVerificationEmail(params: VerificationEmailParams): Promise<{ ok: boolean }>
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<{ ok: boolean }>
  sendSecurityNotification(params: SecurityNotificationParams): Promise<{ ok: boolean }>
}
