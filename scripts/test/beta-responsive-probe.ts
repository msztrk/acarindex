#!/usr/bin/env tsx
/** API probe for responsive fixtures — token değerlerini stdout'a yazmaz. */
import { readFileSync } from 'fs'
import { verifyEmailToken } from '@/lib/auth/verify-email'

function loadEnv(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1)] as [string, string]
      }),
  )
}

async function main(): Promise<void> {
  const path = process.env.ACAR_RESPONSIVE_ENV_FILE ?? '/tokens/tokens.env'
  const env = loadEnv(path)
  const r1 = await verifyEmailToken(env.TOKEN_VERIFY_VALID ?? '')
  console.log(`VERIFY_VALID ok=${r1.ok} err=${r1.error ?? 'none'}`)
  const r2 = await verifyEmailToken(env.TOKEN_VERIFY_VALID ?? '')
  console.log(`VERIFY_VALID_AGAIN ok=${r2.ok} err=${r2.error ?? 'none'}`)
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
