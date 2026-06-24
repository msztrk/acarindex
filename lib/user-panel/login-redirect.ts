export function buildLoginHref(returnPath: string): string {
  const safe =
    returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/hesabim'
  return `/login?next=${encodeURIComponent(safe)}`
}
