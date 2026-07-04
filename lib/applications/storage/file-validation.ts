import { createHash } from 'crypto'
import type { ApplicationAttachmentKind } from '@prisma/client'

export type JournalUploadKind = Extract<ApplicationAttachmentKind, 'cover_image' | 'proof_document'>

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AttachmentValidationError'
  }
}

export type ValidatedApplicationFile = {
  detectedMime: string
  extension: string
  checksumSha256: string
  sizeBytes: number
}

const COVER_MAX_BYTES = 2 * 1024 * 1024
const PROOF_MAX_BYTES = 10 * 1024 * 1024

type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'pdf'

const FORMAT_MIME: Record<DetectedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

const FORMAT_EXT: Record<DetectedFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  pdf: 'pdf',
}

const COVER_FORMATS: DetectedFormat[] = ['jpeg', 'png', 'webp']
const PROOF_FORMATS: DetectedFormat[] = ['pdf']

function bufferStartsWith(buf: Buffer, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false
  return prefix.every((byte, i) => buf[i] === byte)
}

function detectFormat(buffer: Buffer): DetectedFormat | null {
  if (bufferStartsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (bufferStartsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (bufferStartsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (
    buffer.length >= 12 &&
    bufferStartsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

function allowedFormatsForKind(kind: JournalUploadKind): DetectedFormat[] {
  return kind === 'cover_image' ? COVER_FORMATS : PROOF_FORMATS
}

function maxBytesForKind(kind: JournalUploadKind): number {
  return kind === 'cover_image' ? COVER_MAX_BYTES : PROOF_MAX_BYTES
}

export function validateApplicationFile(input: {
  kind: JournalUploadKind
  buffer: Buffer
  mimeType: string
  sizeBytes: number
  originalName?: string
}): ValidatedApplicationFile {
  const { kind, buffer, mimeType, sizeBytes } = input
  const maxBytes = maxBytesForKind(kind)

  if (sizeBytes <= 0 || buffer.length === 0) {
    throw new AttachmentValidationError('Dosya boş olamaz.')
  }
  if (sizeBytes > maxBytes || buffer.length > maxBytes) {
    const limitMb = maxBytes / (1024 * 1024)
    throw new AttachmentValidationError(`Dosya boyutu ${limitMb} MB sınırını aşıyor.`)
  }

  const detected = detectFormat(buffer)
  if (!detected) {
    throw new AttachmentValidationError('Dosya türü tanınamadı veya desteklenmiyor.')
  }

  const allowed = allowedFormatsForKind(kind)
  if (!allowed.includes(detected)) {
    throw new AttachmentValidationError(
      kind === 'cover_image'
        ? 'Kapak görseli yalnızca JPEG, PNG veya WebP olabilir.'
        : 'Destekleyici belge yalnızca PDF olabilir.',
    )
  }

  const detectedMime = FORMAT_MIME[detected]
  const normalizedMime = mimeType.split(';')[0]?.trim().toLowerCase()
  if (normalizedMime && normalizedMime !== detectedMime && normalizedMime !== 'application/octet-stream') {
    throw new AttachmentValidationError('Dosya türü ile içerik uyuşmuyor.')
  }

  return {
    detectedMime,
    extension: FORMAT_EXT[detected],
    checksumSha256: createHash('sha256').update(buffer).digest('hex'),
    sizeBytes: buffer.length,
  }
}

export function isJournalUploadKind(value: string): value is JournalUploadKind {
  return value === 'cover_image' || value === 'proof_document'
}
