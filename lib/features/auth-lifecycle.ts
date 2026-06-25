function envEnabled(name: string): boolean {
  return process.env[name] === '1'
}

export function isPublicRegistrationEnabled(): boolean {
  return envEnabled('ENABLE_PUBLIC_REGISTRATION')
}

export function isEmailVerificationEnabled(): boolean {
  return envEnabled('ENABLE_EMAIL_VERIFICATION')
}

export function isPasswordResetEnabled(): boolean {
  return envEnabled('ENABLE_PASSWORD_RESET')
}

export interface AuthLifecycleFlags {
  publicRegistration: boolean
  emailVerification: boolean
  passwordReset: boolean
  captcha: boolean
}

export function getAuthLifecycleFlags(): AuthLifecycleFlags {
  return {
    publicRegistration: isPublicRegistrationEnabled(),
    emailVerification: isEmailVerificationEnabled(),
    passwordReset: isPasswordResetEnabled(),
    captcha: process.env.ENABLE_CAPTCHA === '1',
  }
}
