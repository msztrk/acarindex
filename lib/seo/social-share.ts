export function buildFacebookShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`
}

export function buildTwitterShareUrl(pageUrl: string, text: string): string {
  const params = new URLSearchParams({
    url: pageUrl,
    text: text.trim(),
  })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function buildLinkedInShareUrl(pageUrl: string, title: string): string {
  const params = new URLSearchParams({
    mini: 'true',
    url: pageUrl,
    title: title.trim(),
  })
  return `https://www.linkedin.com/shareArticle?${params.toString()}`
}

export function buildWhatsAppShareUrl(pageUrl: string): string {
  const params = new URLSearchParams({
    text: pageUrl,
  })
  return `https://api.whatsapp.com/send/?${params.toString()}`
}
