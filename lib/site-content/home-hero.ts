import { prisma } from '@/lib/db/prisma'

export const HOME_HERO_TITLE_KEY = 'home_hero_title'
export const HOME_HERO_SUBTITLE_KEY = 'home_hero_subtitle'

export const DEFAULT_HOME_HERO_TITLE =
  'Türkçe akademik makale, dergi ve yazarları tek yerden keşfedin'

export const HOME_HERO_TITLE_MAX = 120
export const HOME_HERO_SUBTITLE_MAX = 280

export interface HomeHeroContent {
  title: string
  subtitle: string | null
}

function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

export function sanitizePlainText(input: string, maxLen: number): string {
  const trimmed = stripControlChars(input).trim()
  if (trimmed.includes('<') || trimmed.includes('>')) {
    throw new Error('HTML içerik kabul edilmez.')
  }
  if (trimmed.length > maxLen) {
    throw new Error(`Metin ${maxLen} karakterden uzun olamaz.`)
  }
  return trimmed
}

export function validateHomeHeroInput(input: {
  title?: string
  subtitle?: string | null
}): { title: string; subtitle: string | null } {
  const title =
    input.title === undefined || input.title.trim() === ''
      ? DEFAULT_HOME_HERO_TITLE
      : sanitizePlainText(input.title, HOME_HERO_TITLE_MAX)

  let subtitle: string | null = null
  if (input.subtitle !== undefined && input.subtitle !== null && input.subtitle.trim() !== '') {
    subtitle = sanitizePlainText(input.subtitle, HOME_HERO_SUBTITLE_MAX)
  }

  return { title, subtitle }
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function getHomeHeroContent(): Promise<HomeHeroContent> {
  const [titleRaw, subtitleRaw] = await Promise.all([
    readSetting(HOME_HERO_TITLE_KEY),
    readSetting(HOME_HERO_SUBTITLE_KEY),
  ])

  const title =
    titleRaw && titleRaw.trim() !== '' ? titleRaw.trim() : DEFAULT_HOME_HERO_TITLE
  const subtitle =
    subtitleRaw && subtitleRaw.trim() !== '' ? subtitleRaw.trim() : null

  return { title, subtitle }
}

export async function updateHomeHeroContent(
  input: { title?: string; subtitle?: string | null },
  actorId: string,
): Promise<HomeHeroContent> {
  const { title, subtitle } = validateHomeHeroInput(input)

  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: HOME_HERO_TITLE_KEY },
      create: { key: HOME_HERO_TITLE_KEY, value: title, updatedBy: actorId },
      update: { value: title, updatedBy: actorId },
    }),
    prisma.siteSetting.upsert({
      where: { key: HOME_HERO_SUBTITLE_KEY },
      create: {
        key: HOME_HERO_SUBTITLE_KEY,
        value: subtitle ?? '',
        updatedBy: actorId,
      },
      update: { value: subtitle ?? '', updatedBy: actorId },
    }),
  ])

  return { title, subtitle }
}
