/** CAPTCHA adapter — provider seçimi feature flag ile; varsayılan kapalı. */

export interface CaptchaVerifier {
  verify(token: string | undefined, remoteIp?: string): Promise<boolean>
}

class NoCaptchaVerifier implements CaptchaVerifier {
  async verify(): Promise<boolean> {
    return true
  }
}

export function getCaptchaVerifier(): CaptchaVerifier {
  if (process.env.ENABLE_CAPTCHA !== '1') {
    return new NoCaptchaVerifier()
  }
  // Gerçek provider (Turnstile/hCaptcha) credential onayı sonrası
  return new NoCaptchaVerifier()
}

export function isCaptchaRequired(): boolean {
  return process.env.ENABLE_CAPTCHA === '1'
}
