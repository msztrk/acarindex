import { redirect } from 'next/navigation'
import { resolveLegacyAuthRedirect } from '@/lib/seo/legacy-auth-redirects'

interface PageProps {
  params: Promise<{ legacyPath: string[] }>
}

export default async function LegacyProfilSubPage({ params }: PageProps) {
  const { legacyPath } = await params
  const pathname = `/profil/${legacyPath.join('/')}`
  redirect(resolveLegacyAuthRedirect(pathname) ?? '/hesabim')
}
