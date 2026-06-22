/**
 * Author upsert: source_key zorunlu, onConflict source_key.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SOURCE_KEY_MIGRATION_HINT } from './author-source-key'

export interface AuthorUpsertRow {
  source_key: string
  legacy_id: number | null
  name: string
  slug: string
  is_provisional: boolean
}

export async function ensureAuthorsSourceKeyColumn(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.from('authors').select('source_key').limit(1)
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('source_key') || msg.includes('column')) {
      throw new Error(SOURCE_KEY_MIGRATION_HINT)
    }
    throw new Error(`authors şema kontrolü başarısız: ${msg}`)
  }
}

export async function upsertAuthorsBySourceKey(
  sb: SupabaseClient,
  rows: AuthorUpsertRow[],
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null }
  const deduped = [...new Map(rows.map((r) => [r.source_key, r])).values()]
  const { error } = await sb.from('authors').upsert(deduped, { onConflict: 'source_key' })
  return { error: error?.message ?? null }
}

export async function fetchAuthorIdsBySourceKey(
  sb: SupabaseClient,
  sourceKeys: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const CHUNK = 200
  for (let i = 0; i < sourceKeys.length; i += CHUNK) {
    const chunk = sourceKeys.slice(i, i + CHUNK)
    const { data, error } = await sb.from('authors').select('id, source_key').in('source_key', chunk)
    if (error) throw new Error(`authors source_key lookup: ${error.message}`)
    for (const row of data ?? []) {
      if (row.source_key) map.set(row.source_key as string, row.id as number)
    }
  }
  return map
}

export async function loadExistingAuthorSourceKeys(sb: SupabaseClient): Promise<Set<string>> {
  const keys = new Set<string>()
  let offset = 0
  const SIZE = 1000
  while (true) {
    const { data, error } = await sb
      .from('authors')
      .select('source_key')
      .not('source_key', 'is', null)
      .range(offset, offset + SIZE - 1)
    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('source_key') || msg.includes('column')) {
        throw new Error(SOURCE_KEY_MIGRATION_HINT)
      }
      throw new Error(`source_key state load: ${msg}`)
    }
    if (!data?.length) break
    for (const row of data) {
      if (row.source_key) keys.add(row.source_key as string)
    }
    if (data.length < SIZE) break
    offset += SIZE
  }
  return keys
}
