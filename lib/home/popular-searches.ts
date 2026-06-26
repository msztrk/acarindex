/** Pilot kapsamında sabit popüler aramalar (ileride dinamikleştirilebilir). */
export const POPULAR_SEARCHES = [
  { label: 'Eğitim', href: '/search?q=eğitim&type=article' },
  { label: 'Türk Dili', href: '/search?q=türk+dili&type=article' },
  { label: 'İktisat', href: '/search?q=iktisat&type=article' },
  { label: 'Tıp', href: '/search?q=tıp&type=article' },
  { label: 'Mühendislik', href: '/search?q=mühendislik&type=article' },
  { label: 'Hukuk', href: '/search?q=hukuk&type=article' },
] as const
