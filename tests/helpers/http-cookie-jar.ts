/** Node fetch için basit cookie jar — entegrasyon testleri */
export class HttpCookieJar {
  private cookies = new Map<string, string>()

  absorb(response: Response): void {
    const raw = response.headers.getSetCookie?.() ?? []
    for (const line of raw) {
      const part = line.split(';')[0]
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const name = part.slice(0, eq).trim()
      const value = part.slice(eq + 1).trim()
      if (value) this.cookies.set(name, value)
      else this.cookies.delete(name)
    }
    const legacy = response.headers.get('set-cookie')
    if (legacy && raw.length === 0) {
      for (const line of legacy.split(/,(?=\s*\w+=)/)) {
        const part = line.split(';')[0]
        const eq = part.indexOf('=')
        if (eq <= 0) continue
        const name = part.slice(0, eq).trim()
        const value = part.slice(eq + 1).trim()
        if (value) this.cookies.set(name, value)
      }
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  get(name: string): string | undefined {
    return this.cookies.get(name)
  }

  set(name: string, value: string): void {
    this.cookies.set(name, value)
  }

  clear(): void {
    this.cookies.clear()
  }
}

export async function fetchWithJar(
  jar: HttpCookieJar,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const cookie = jar.header()
  if (cookie) headers.set('cookie', cookie)
  const res = await fetch(url, { ...init, headers })
  jar.absorb(res)
  return res
}
