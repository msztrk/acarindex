import {
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildTwitterShareUrl,
  buildWhatsAppShareUrl,
} from '@/lib/seo/social-share'
import { cn } from '@/lib/utils'

const linkFocusClass =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

type ShareLink = {
  id: string
  href: string
  label: string
  icon: React.ReactNode
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.2-6.8L5.4 22H2.3l7.3-8.4L.8 2h6.9l4.7 6.2L18.9 2Zm-1.2 18h1.9L7.1 4H5.1l12.6 16Z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2ZM8 19H5v-9h3v9ZM6.5 8.2A1.8 1.8 0 1 1 6.5 4.6a1.8 1.8 0 0 1 0 3.6ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5s-1.7 1.2-1.7 2.4V19h-3v-9h2.9v1.2h.1c.4-.8 1.4-1.7 2.9-1.7 3.1 0 3.7 2 3.7 4.7V19Z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M17.5 14.5c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.5.1-.2.2-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.6.1-.1.2-.3.3-.4.1-.1.1-.2.2-.3.1-.1.1-.2 0-.4-.1-.2-.5-1.2-.7-1.6-.2-.4-.4-.3-.5-.3h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 3.9 3.4.5.2.9.3 1.2.4.5.2 1 .2 1.4.1.4-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.1-.6-.2ZM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4A9.9 9.9 0 0 0 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.5-4.4-1.3l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 0 1 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z" />
    </svg>
  )
}

export function ArticleSocialShare({
  pageUrl,
  title,
  className,
  labels,
}: {
  pageUrl: string
  title: string
  className?: string
  labels?: {
    share: string
    facebook: string
    twitter: string
    linkedin: string
    whatsapp: string
  }
}) {
  const shareLabel = labels?.share ?? 'Paylaş'
  const iconClass = 'h-[1.125rem] w-[1.125rem]'

  const links: ShareLink[] = [
    {
      id: 'facebook',
      href: buildFacebookShareUrl(pageUrl),
      label: labels?.facebook ?? "Facebook'ta Paylaş",
      icon: <FacebookIcon className={iconClass} />,
    },
    {
      id: 'twitter',
      href: buildTwitterShareUrl(pageUrl, title),
      label: labels?.twitter ?? "X'te Paylaş",
      icon: <XIcon className={iconClass} />,
    },
    {
      id: 'linkedin',
      href: buildLinkedInShareUrl(pageUrl, title),
      label: labels?.linkedin ?? "LinkedIn'de Paylaş",
      icon: <LinkedInIcon className={iconClass} />,
    },
    {
      id: 'whatsapp',
      href: buildWhatsAppShareUrl(pageUrl),
      label: labels?.whatsapp ?? "WhatsApp'ta Paylaş",
      icon: <WhatsAppIcon className={iconClass} />,
    },
  ]

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted-foreground">{shareLabel}</span>
      <ul className="flex flex-wrap items-center gap-2.5 list-none m-0 p-0">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              className={cn(
                'inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors',
                linkFocusClass,
              )}
            >
              {link.icon}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
