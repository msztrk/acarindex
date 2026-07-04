import { createHash, randomUUID } from 'crypto'
import type {
  ApplicationStorageProvider,
  ApplicationStoragePutInput,
  ApplicationStoragePutResult,
} from '@/lib/applications/storage/provider'

const DEFAULT_API_URL = 'https://api.backblazeb2.com'
const DEFAULT_SIGNED_URL_TTL = 300

type B2AuthorizeResponse = {
  accountId: string
  apiUrl: string
  authorizationToken: string
  downloadUrl: string
}

type B2Bucket = {
  bucketId: string
  bucketName: string
}

type B2UploadUrlResponse = {
  uploadUrl: string
  authorizationToken: string
}

type B2DownloadAuthResponse = {
  authorizationToken: string
}

type B2FileVersion = {
  fileId: string
  fileName: string
}

type CachedAuth = {
  apiUrl: string
  downloadUrl: string
  authorizationToken: string
  bucketId: string
  bucketName: string
  fetchedAt: number
}

export type B2ApplicationStorageConfig = {
  keyId: string
  applicationKey: string
  bucketName: string
  apiUrl?: string
  signedUrlTtlSeconds?: number
}

function extensionFromName(originalName: string): string {
  const parts = originalName.split('.')
  if (parts.length > 1) {
    const ext = parts.pop()?.toLowerCase()
    if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext
  }
  return 'bin'
}

export function createB2ApplicationStorage(config: B2ApplicationStorageConfig): ApplicationStorageProvider {
  const apiBase = config.apiUrl?.replace(/\/$/, '') || DEFAULT_API_URL
  const signedUrlTtl = config.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL
  let cache: CachedAuth | null = null

  async function authorize(): Promise<CachedAuth> {
    const now = Date.now()
    if (cache && now - cache.fetchedAt < 23 * 60 * 60 * 1000) {
      return cache
    }

    const credentials = Buffer.from(`${config.keyId}:${config.applicationKey}`).toString('base64')
    const res = await fetch(`${apiBase}/b2api/v2/b2_authorize_account`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!res.ok) {
      throw new Error('B2 authorization failed')
    }
    const auth = (await res.json()) as B2AuthorizeResponse

    const bucketsRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId: auth.accountId, bucketName: config.bucketName }),
    })
    if (!bucketsRes.ok) {
      throw new Error('B2 bucket lookup failed')
    }
    const bucketsBody = (await bucketsRes.json()) as { buckets: B2Bucket[] }
    const bucket = bucketsBody.buckets.find((b) => b.bucketName === config.bucketName)
    if (!bucket) {
      throw new Error('B2 bucket not found')
    }

    cache = {
      apiUrl: auth.apiUrl,
      downloadUrl: auth.downloadUrl,
      authorizationToken: auth.authorizationToken,
      bucketId: bucket.bucketId,
      bucketName: bucket.bucketName,
      fetchedAt: now,
    }
    return cache
  }

  async function getUploadUrl(auth: CachedAuth): Promise<B2UploadUrlResponse> {
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucketId: auth.bucketId }),
    })
    if (!res.ok) {
      throw new Error('B2 upload URL request failed')
    }
    return (await res.json()) as B2UploadUrlResponse
  }

  return {
    async putObject(input: ApplicationStoragePutInput): Promise<ApplicationStoragePutResult> {
      const auth = await authorize()
      const upload = await getUploadUrl(auth)
      const ext = extensionFromName(input.originalName)
      const storageKey = `applications/${input.applicationId}/${randomUUID()}.${ext}`
      const sha1 = createHash('sha1').update(input.body).digest('hex')
      const checksumSha256 = createHash('sha256').update(input.body).digest('hex')

      const uploadRes = await fetch(upload.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: upload.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(storageKey),
          'Content-Type': input.mimeType,
          'Content-Length': String(input.sizeBytes),
          'X-Bz-Content-Sha1': sha1,
        },
        body: input.body,
      })
      if (!uploadRes.ok) {
        throw new Error('B2 upload failed')
      }

      return { storageKey, checksumSha256 }
    },

    async deleteObject(storageKey: string): Promise<void> {
      const auth = await authorize()
      const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: auth.bucketId,
          prefix: storageKey,
          maxFileCount: 1,
        }),
      })
      if (!listRes.ok) {
        throw new Error('B2 list file failed')
      }
      const listBody = (await listRes.json()) as { files: B2FileVersion[] }
      const file = listBody.files.find((f) => f.fileName === storageKey)
      if (!file) return

      const deleteRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: file.fileName, fileId: file.fileId }),
      })
      if (!deleteRes.ok) {
        throw new Error('B2 delete failed')
      }
    },

    async getSignedDownloadUrl(storageKey: string, expiresInSeconds = signedUrlTtl): Promise<string> {
      const auth = await authorize()
      const authRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: auth.bucketId,
          fileNamePrefix: storageKey,
          validDurationInSeconds: expiresInSeconds,
        }),
      })
      if (!authRes.ok) {
        throw new Error('B2 download authorization failed')
      }
      const downloadAuth = (await authRes.json()) as B2DownloadAuthResponse
      const encodedName = storageKey.split('/').map(encodeURIComponent).join('/')
      return `${auth.downloadUrl}/file/${auth.bucketName}/${encodedName}?Authorization=${downloadAuth.authorizationToken}`
    },
  }
}
