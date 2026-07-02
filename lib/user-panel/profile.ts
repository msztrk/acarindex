import { prisma } from '@/lib/db/prisma'
import { logUserActivity } from '@/lib/user-panel/summary'

export interface UserProfileDto {
  firstName: string
  lastName: string
  institution: string
  scienceField: string
  interestAreas: string[]
}

const MAX_NAME = 120
const MAX_INSTITUTION = 300
const MAX_FIELD = 200
const MAX_INTEREST_AREAS = 8

function splitDisplayName(name: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

function buildDisplayName(firstName: string, lastName: string): string | null {
  const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
  return full || null
}

function normalizeProfileInput(input: Partial<UserProfileDto>): UserProfileDto {
  return {
    firstName: (input.firstName ?? '').trim().slice(0, MAX_NAME),
    lastName: (input.lastName ?? '').trim().slice(0, MAX_NAME),
    institution: (input.institution ?? '').trim().slice(0, MAX_INSTITUTION),
    scienceField: (input.scienceField ?? '').trim().slice(0, MAX_FIELD),
    interestAreas: Array.from(
      new Set(
        (input.interestAreas ?? [])
          .map((v) => v.trim().slice(0, MAX_FIELD))
          .filter(Boolean),
      ),
    ).slice(0, MAX_INTEREST_AREAS),
  }
}

export async function getUserProfile(userId: string): Promise<UserProfileDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: true },
  })
  if (!user) {
    return { firstName: '', lastName: '', institution: '', scienceField: '', interestAreas: [] }
  }

  const fromName = splitDisplayName(user.name)
  const profile = user.profile

  return {
    firstName: profile?.firstName?.trim() || fromName.firstName,
    lastName: profile?.lastName?.trim() || fromName.lastName,
    institution: profile?.institution?.trim() ?? '',
    scienceField: profile?.scienceField?.trim() ?? '',
    interestAreas: profile?.interestAreas ?? [],
  }
}

export async function updateUserProfile(
  userId: string,
  input: Partial<UserProfileDto>,
  ipAddress?: string,
): Promise<UserProfileDto> {
  const data = normalizeProfileInput(input)
  const displayName = buildDisplayName(data.firstName, data.lastName)

  await prisma.$transaction([
    prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        institution: data.institution || null,
        scienceField: data.scienceField || null,
        interestAreas: data.interestAreas,
      },
      update: {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        institution: data.institution || null,
        scienceField: data.scienceField || null,
        interestAreas: data.interestAreas,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { name: displayName },
    }),
  ])

  await logUserActivity(userId, 'user.profile.update', { scienceField: data.scienceField }, ipAddress)
  return data
}

export function validateProfileCategorySelections(
  scienceField: string,
  interestAreas: string[],
  allowedLabels: string[],
): boolean {
  const allowed = new Set(allowedLabels)
  if (scienceField && !allowed.has(scienceField)) return false
  return interestAreas.every((area) => allowed.has(area))
}
