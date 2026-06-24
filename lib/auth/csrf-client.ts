/** Client-side CSRF yardımcıları — logout ve form POST'ları için */
export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
  if (!res.ok) return ''
  const data = (await res.json()) as { csrfToken?: string }
  return data.csrfToken ?? ''
}

export async function postWithCsrf(
  url: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const csrf = await fetchCsrfToken()
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify(body),
  })
}

export async function deleteWithCsrf(
  url: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const csrf = await fetchCsrfToken()
  return fetch(url, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify(body),
  })
}
