/** Header/footer için sunucudan aktarılan oturum özeti */
export interface PublicSessionUser {
  email: string
  name: string | null
}

export interface PublicAuthState {
  authenticated: boolean
  user?: PublicSessionUser
}

export function initialsFromUser(user: PublicSessionUser): string {
  const source = user.name?.trim() || user.email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toLocaleUpperCase('tr-TR')
  }
  return source.slice(0, 2).toLocaleUpperCase('tr-TR')
}

export function displayNameFromUser(user: PublicSessionUser): string {
  return user.name?.trim() || user.email.split('@')[0] || 'Hesabım'
}
