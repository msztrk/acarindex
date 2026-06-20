import type { Metadata } from 'next'
import { Mail, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'İletişim — AcarIndex',
  description: 'AcarIndex ile iletişime geçin. Dergi ekleme, güncelleme ve diğer talepler için.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'}/contact`,
  },
}

const contactItems = [
  {
    icon: Mail,
    label: 'E-posta',
    value: 'info@acarindex.com',
    href: 'mailto:info@acarindex.com',
  },
]

const topics = [
  { title: 'Dergi Ekleme / Güncelleme', desc: 'Dergilerinizin platforma eklenmesi veya mevcut bilgilerin güncellenmesi için.' },
  { title: 'Makale Düzeltme', desc: 'Yanlış veya eksik makale bilgileri için.' },
  { title: 'API Erişimi', desc: 'Programatik veri erişimi talebiniz için.' },
  { title: 'Teknik Destek', desc: 'Platform ile ilgili teknik sorunlar için.' },
  { title: 'Genel Bilgi', desc: 'Diğer tüm konular için.' },
]

export default function ContactPage() {
  return (
    <div className="content-width py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl font-bold mb-4">İletişim</h1>
        <p className="text-muted-foreground mb-10 leading-relaxed">
          Dergi ekleme, makale düzeltme veya diğer konularda aşağıdaki iletişim kanallarından
          bize ulaşabilirsiniz.
        </p>

        {/* İletişim bilgileri */}
        <section className="mb-12">
          <div className="space-y-3">
            {contactItems.map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-accent/40 hover:bg-secondary/30 transition-all no-underline group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{value}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </section>

        {/* Konu başlıkları */}
        <section>
          <h2 className="font-serif text-xl font-semibold mb-4">Konu Başlıkları</h2>
          <p className="text-sm text-muted-foreground mb-4">
            E-postanıza konu satırında aşağıdaki başlıklardan birini eklemeniz
            talebinizin daha hızlı işlenmesini sağlar.
          </p>
          <div className="space-y-2">
            {topics.map(({ title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg bg-secondary/40">
                <span className="text-sm font-medium text-foreground w-52 shrink-0">{title}</span>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Yanıt süresi */}
        <div className="mt-10 p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground">
          <strong className="text-foreground">Yanıt süresi:</strong> Talepler genellikle 3-5 iş
          günü içinde yanıtlanmaktadır. Acil durumlar için lütfen e-posta konusuna{' '}
          <code className="bg-secondary px-1 rounded text-xs">[ACIL]</code> ekleyin.
        </div>
      </div>
    </div>
  )
}
