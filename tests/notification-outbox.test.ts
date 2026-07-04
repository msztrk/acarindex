import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  notificationOutbox: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
}))

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/email/provider', () => ({
  getTransactionEmailProvider: () => ({ send: mockSend }),
}))

import { processNotificationOutbox } from '@/lib/notifications/process-outbox'

describe('notification outbox processor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ ok: true })
  })

  it('marks pending row as sent on successful send', async () => {
    const row = {
      id: 'out-1',
      type: 'journal_application.approved',
      recipient: 'user@example.com',
      payload: { title: 'Test Dergi' },
      status: 'pending',
      createdAt: new Date(),
    }
    mockPrisma.notificationOutbox.findMany.mockResolvedValue([row])
    mockPrisma.notificationOutbox.update.mockResolvedValue({})

    const processed = await processNotificationOutbox(10)

    expect(processed).toBe(1)
    expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-1' },
        data: expect.objectContaining({ status: 'processing' }),
      }),
    )
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Dergi başvurunuz onaylandı',
      }),
    )
    expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-1' },
        data: expect.objectContaining({ status: 'sent' }),
      }),
    )
  })

  it('marks unknown type as failed', async () => {
    mockPrisma.notificationOutbox.findMany.mockResolvedValue([
      {
        id: 'out-2',
        type: 'unknown.event',
        recipient: 'user@example.com',
        payload: {},
        status: 'pending',
        createdAt: new Date(),
      },
    ])
    mockPrisma.notificationOutbox.update.mockResolvedValue({})

    const processed = await processNotificationOutbox(5)

    expect(processed).toBe(0)
    expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-2' },
        data: expect.objectContaining({
          status: 'failed',
          lastError: expect.stringContaining('Unknown notification type'),
        }),
      }),
    )
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('marks row failed when provider returns error', async () => {
    mockSend.mockResolvedValue({ ok: false, error: 'rate limited' })
    mockPrisma.notificationOutbox.findMany.mockResolvedValue([
      {
        id: 'out-3',
        type: 'journal_application.rejected',
        recipient: 'user@example.com',
        payload: { title: 'Dergi X', note: 'Eksik belge' },
        status: 'pending',
        createdAt: new Date(),
      },
    ])
    mockPrisma.notificationOutbox.update.mockResolvedValue({})

    const processed = await processNotificationOutbox(1)

    expect(processed).toBe(0)
    expect(mockPrisma.notificationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-3' },
        data: expect.objectContaining({ status: 'failed', lastError: 'rate limited' }),
      }),
    )
  })

  it('returns zero when no pending rows', async () => {
    mockPrisma.notificationOutbox.findMany.mockResolvedValue([])
    expect(await processNotificationOutbox()).toBe(0)
    expect(mockSend).not.toHaveBeenCalled()
  })
})
