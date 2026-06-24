import { prisma } from '@/lib/db/prisma'
import { parsePagination, paginationMeta } from '@/lib/admin/pagination'

export async function loadPaginatedJournals(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.journal.findMany({
      orderBy: { id: 'asc' },
      skip,
      take: pageSize,
      select: { id: true, slug: true, titleTr: true, status: true },
    }),
    prisma.journal.count(),
  ])
  return {
    rows: rows.map((r) => ({ ...r, id: Number(r.id) })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedIssues(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      orderBy: { id: 'asc' },
      skip,
      take: pageSize,
      select: { id: true, journalId: true, issueLabel: true, year: true },
    }),
    prisma.issue.count(),
  ])
  return {
    rows: rows.map((r) => ({ ...r, id: Number(r.id), journalId: Number(r.journalId) })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedArticles(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      orderBy: { id: 'asc' },
      skip,
      take: pageSize,
      select: { id: true, slug: true, titleTr: true, legacyJournalSlug: true, status: true },
    }),
    prisma.article.count(),
  ])
  return {
    rows: rows.map((r) => ({ ...r, id: Number(r.id) })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedAuthors(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.author.findMany({
      orderBy: { id: 'asc' },
      skip,
      take: pageSize,
      select: { id: true, name: true, slug: true, isProvisional: true },
    }),
    prisma.author.count(),
  ])
  return {
    rows: rows.map((r) => ({ ...r, id: Number(r.id) })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedPdfs(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.pdfFile.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: { id: true, articleId: true, fileStatus: true, fileSizeBytes: true },
    }),
    prisma.pdfFile.count(),
  ])
  return {
    rows: rows.map((r) => ({
      ...r,
      articleId: Number(r.articleId),
      fileSizeBytes: r.fileSizeBytes ? Number(r.fileSizeBytes) : null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedEtlRuns(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.etlRun.findMany({
      orderBy: { startedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.etlRun.count(),
  ])
  return {
    rows: rows.map((r) => ({
      ...r,
      id: Number(r.id),
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedUrlAliases(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.urlAlias.findMany({
      orderBy: { legacyPath: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.urlAlias.count(),
  ])
  return {
    rows: rows.map((r) => ({
      ...r,
      entityId: r.entityId != null ? Number(r.entityId) : null,
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedAuditLogs(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ])
  return {
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}

export async function loadPaginatedUsers(searchParams: Record<string, string | string[] | undefined>) {
  const { page, pageSize, skip } = parsePagination(searchParams)
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { roles: { include: { role: true } } },
    }),
    prisma.user.count(),
  ])
  return {
    rows: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      emailVerified: u.emailVerified?.toISOString() ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      roles: u.roles.map((r) => r.roleId),
    })),
    meta: paginationMeta(total, page, pageSize),
  }
}
