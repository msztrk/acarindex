#!/usr/bin/env tsx
/**
 * Minimal B2 application storage connectivity test (upload + delete).
 * Requires APPLICATION_STORAGE_PROVIDER=b2 and B2_APPLICATION_* env vars.
 * Never logs secrets.
 */
import { createB2ApplicationStorage } from '@/lib/applications/storage/b2-provider'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`${name} gerekli`)
    process.exit(1)
  }
  return value
}

async function main(): Promise<void> {
  const provider = process.env.APPLICATION_STORAGE_PROVIDER?.trim().toLowerCase()
  if (provider !== 'b2') {
    console.error('APPLICATION_STORAGE_PROVIDER=b2 gerekli')
    process.exit(1)
  }

  const storage = createB2ApplicationStorage({
    keyId: requireEnv('B2_APPLICATION_KEY_ID'),
    applicationKey: requireEnv('B2_APPLICATION_KEY'),
    bucketName: requireEnv('B2_APPLICATION_BUCKET'),
    apiUrl: process.env.B2_APPLICATION_ENDPOINT?.trim() || undefined,
  })

  const body = Buffer.from('acarindex-b2-pilot-probe')
  const { storageKey } = await storage.putObject({
    applicationId: 'b2-probe',
    originalName: 'probe.txt',
    mimeType: 'text/plain',
    sizeBytes: body.length,
    body,
  })

  await storage.deleteObject(storageKey)
  console.log('b2_storage_probe_ok')
}

main().catch((error) => {
  console.error('B2 storage probe failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
