interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[]
}

/** Yapısal veri için `<script type="application/ld+json">` */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
