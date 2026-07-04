import { createHash, randomUUID } from 'crypto'
import type {
  ApplicationStorageProvider,
  ApplicationStoragePutInput,
  ApplicationStoragePutResult,
} from '@/lib/applications/storage/provider'

const store = new Map<string, Buffer>()

export function createMemoryApplicationStorage(): ApplicationStorageProvider {
  return {
    async putObject(input: ApplicationStoragePutInput): Promise<ApplicationStoragePutResult> {
      const ext = input.originalName.includes('.')
        ? input.originalName.split('.').pop()!
        : 'bin'
      const storageKey = `applications/${input.applicationId}/${randomUUID()}.${ext}`
      const checksumSha256 = createHash('sha256').update(input.body).digest('hex')
      store.set(storageKey, input.body)
      return { storageKey, checksumSha256 }
    },
    async deleteObject(storageKey: string) {
      store.delete(storageKey)
    },
    async getSignedDownloadUrl(storageKey: string) {
      if (!store.has(storageKey)) throw new Error('Object not found')
      return `memory://${storageKey}`
    },
  }
}

/** Test helper */
export function clearMemoryApplicationStorage() {
  store.clear()
}
