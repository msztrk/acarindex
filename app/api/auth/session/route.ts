import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { isUserAuthEnabled } from '@/lib/features/user-auth'

export async function GET() {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ authenticated: false }, { status: 404 })
  }
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: session.user.roles,
    },
  })
}
