import { createB2ApplicationStorage } from '@/lib/applications/storage/b2-provider'
import { createMemoryApplicationStorage } from '@/lib/applications/storage/memory-provider'
import type { ApplicationStorageProvider } from '@/lib/applications/storage/provider'

let singleton: ApplicationStorageProvider | null = null

function resolveProviderName(): 'memory' | 'b2' {
  const raw = process.env.APPLICATION_STORAGE_PROVIDER?.trim().toLowerCase()
  if (raw === 'b2') return 'b2'
  return 'memory'
}

function createProvider(): ApplicationStorageProvider {
  const provider = resolveProviderName()
  if (provider === 'b2') {
    const keyId = process.env.B2_APPLICATION_KEY_ID?.trim()
    const applicationKey = process.env.B2_APPLICATION_KEY?.trim()
    const bucketName = process.env.B2_APPLICATION_BUCKET?.trim()
    if (!keyId || !applicationKey || !bucketName) {
      throw new Error('B2 storage selected but credentials or bucket are missing')
    }
    return createB2ApplicationStorage({
      keyId,
      applicationKey,
      bucketName,
      apiUrl: process.env.B2_APPLICATION_ENDPOINT?.trim() || undefined,
    })
  }
  return createMemoryApplicationStorage()
}

/** Shared storage provider (memory in dev/test unless APPLICATION_STORAGE_PROVIDER=b2). */
export function getApplicationStorage(): ApplicationStorageProvider {
  if (!singleton) {
    singleton = createProvider()
  }
  return singleton
}

/** Test helper — reset cached singleton between tests. */
export function resetApplicationStorageForTests() {
  singleton = null
}
