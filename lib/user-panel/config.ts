export const RECENT_VIEWS_MAX = 50
export const READING_LIST_NAME_MAX = 120
export const USER_PANEL_WRITE_LIMIT = 60
export const USER_PANEL_WRITE_WINDOW_MS = 60 * 1000

export const ENTITY_TYPES = ['article', 'journal', 'author'] as const
export type RecentEntityType = (typeof ENTITY_TYPES)[number]

export function isRecentEntityType(value: string): value is RecentEntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value)
}
