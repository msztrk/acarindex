import { prisma } from '@/lib/db/prisma'
import { getTransactionEmailProvider } from '@/lib/email/provider'

const DEFAULT_BATCH = 20

function buildEmailFromPayload(
  type: string,
  payload: Record<string, unknown>,
): { subject: string; text: string; html: string } | null {
  const title = String(payload.title ?? 'Başvurunuz')
  switch (type) {
    case 'journal_application.approved':
      return {
        subject: 'Dergi başvurunuz onaylandı',
        text: `"${title}" başvurunuz onaylandı. Dergi kaydı taslak olarak oluşturuldu.`,
        html: `<p><strong>${title}</strong> başvurunuz onaylandı. Dergi kaydı taslak olarak oluşturuldu.</p>`,
      }
    case 'journal_application.rejected':
      return {
        subject: 'Dergi başvurunuz reddedildi',
        text: `"${title}" başvurunuz reddedildi.${payload.note ? ` Not: ${payload.note}` : ''}`,
        html: `<p><strong>${title}</strong> başvurunuz reddedildi.</p>${payload.note ? `<p>Not: ${payload.note}</p>` : ''}`,
      }
    case 'journal_application.revision_requested':
      return {
        subject: 'Dergi başvurunuz için düzeltme istendi',
        text: `"${title}" başvurunuz için düzeltme istendi.${payload.note ? ` Not: ${payload.note}` : ''}`,
        html: `<p><strong>${title}</strong> başvurunuz için düzeltme istendi.</p>${payload.note ? `<p>Not: ${payload.note}</p>` : ''}`,
      }
    default:
      return null
  }
}

/** Stub/batch processor — safe to run from cron; Resend optional. */
export async function processNotificationOutbox(limit = DEFAULT_BATCH): Promise<number> {
  const rows = await prisma.notificationOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let processed = 0
  for (const row of rows) {
    await prisma.notificationOutbox.update({
      where: { id: row.id },
      data: { status: 'processing', attemptCount: { increment: 1 } },
    })

    const payload = row.payload as Record<string, unknown>
    const email = buildEmailFromPayload(row.type, payload)

    if (!email) {
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          lastError: `Unknown notification type: ${row.type}`,
        },
      })
      continue
    }

    try {
      const provider = getTransactionEmailProvider()
      const result = await provider.send({
        to: row.recipient,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })

      if (result.ok) {
        await prisma.notificationOutbox.update({
          where: { id: row.id },
          data: { status: 'sent', sentAt: new Date(), lastError: null },
        })
        processed += 1
      } else {
        await prisma.notificationOutbox.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            lastError: result.error ?? 'send failed',
          },
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'processor error'
      if (process.env.NODE_ENV !== 'production') {
        console.info('[notification-outbox] send skipped or failed:', row.type, message)
      }
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: 'pending',
          lastError: message,
          nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      })
    }
  }

  return processed
}
