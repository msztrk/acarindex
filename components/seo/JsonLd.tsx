interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[]
}

/** Yapısal veri için `<script type="application/ld+json">` */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
