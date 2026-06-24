import { NextResponse } from 'next/server'
import { getAuthUiFlags } from '@/lib/features/user-auth'

/** Runtime UI flag'leri — yetkilendirme için kullanılmaz */
export async function GET() {
  return NextResponse.json(getAuthUiFlags())
}
