import { NextResponse } from 'next/server'
import { searchInstitutions } from '@/lib/journal-applications/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const institutions = await searchInstitutions(q)
  return NextResponse.json({ institutions })
}
