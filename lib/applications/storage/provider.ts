export type ApplicationStoragePutInput = {
  applicationId: string
  kind: string
  originalName: string
  mimeType: string
  sizeBytes: number
  body: Buffer
}

export type ApplicationStoragePutResult = {
  storageKey: string
  checksumSha256: string
}

export type ApplicationStorageProvider = {
  putObject(input: ApplicationStoragePutInput): Promise<ApplicationStoragePutResult>
  deleteObject(storageKey: string): Promise<void>
  getSignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>
}

/** Faz B: Backblaze B2 private bucket implementation. */
export type ApplicationStorageConfig = {
  provider: 'memory' | 'b2'
  bucket?: string
  prefix?: string
}
