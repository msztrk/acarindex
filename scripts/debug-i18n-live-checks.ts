/**
 * One-off diagnostic for validate-i18n live redirect checks (beta / local).
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import { buildArticlePath } from '../lib/i18n/slugs'
import {
  publishedEnglishArticleSelect,
  publishedEnglishArticleWhere,
} from '../lib/i18n/prisma-english-content'
import { hasEnglishArticleContent } from '../lib/i18n/content-availability'

const LIVE = process.env.I18N_VALIDATE_BASE_URL ?? 'http://127.0.0.1:3002'

async function main() {
  const noEn = await prisma.article.findFirst({
    where: { status: 'published', hasEnContent: false, slugEn: { not: null } },
    select: publishedEnglishArticleSelect,
  })
  const withEn = await prisma.article.findFirst({
    where: publishedEnglishArticleWhere,
    select: publishedEnglishArticleSelect,
  })

  console.log('LIVE_BASE', LIVE)
  console.log('noEn id', noEn?.id?.toString(), 'slugEn', noEn?.slugEn)

  if (noEn) {
    const parts = {
      id: Number(noEn.id),
      slug: noEn.slug,
      slugTr: noEn.slugTr,
      slugEn: noEn.slugEn,
      legacyJournalSlug: noEn.legacyJournalSlug,
      legacyJournalSlugEn: noEn.legacyJournalSlugEn,
    }
    const enPath = buildArticlePath(parts, 'en')
    const trPath = buildArticlePath(parts, 'tr')
    const res = await fetch(`${LIVE}${enPath}`, { redirect: 'manual' })
    const loc = res.headers.get('location') ?? ''
    console.log('noEn enPath', enPath)
    console.log('noEn trPath', trPath)
    console.log('noEn status', res.status, 'location', loc)
    console.log('noEn loc includes trPath', loc.includes(trPath))
    const follow = await fetch(`${LIVE}${enPath}`, { redirect: 'follow' })
    console.log('noEn follow url', follow.url)
    console.log('noEn hasEnglish', hasEnglishArticleContent(noEn))
    console.log('noEn loop?', follow.url.includes('/en/') && !hasEnglishArticleContent(noEn))
  }

  if (withEn) {
    const enPath = buildArticlePath(
      {
        id: Number(withEn.id),
        slug: withEn.slug,
        slugTr: withEn.slugTr,
        slugEn: withEn.slugEn,
        legacyJournalSlug: withEn.legacyJournalSlug,
        legacyJournalSlugEn: withEn.legacyJournalSlugEn,
      },
      'en',
    )
    const res = await fetch(`${LIVE}${enPath}`, { redirect: 'manual' })
    console.log('withEn enPath', enPath, 'status', res.status, 'location', res.headers.get('location'))
  }

  const missing = await prisma.article.findFirst({ where: { id: 999999999n } })
  console.log('missing999 in db', !!missing)
  const res404 = await fetch(`${LIVE}/en/foo/missing-article-999999999`, { redirect: 'manual' })
  console.log('missing404 status', res404.status)
}

main()
  .then(() => disconnectPrisma())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
