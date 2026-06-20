import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

console.log('URL:', url.substring(0, 30))
console.log('Key prefix:', key.substring(0, 20))

const sb = createClient(url, key)

async function main() {
  const { data, error } = await sb.from('platform_stats').select('*').single()
  console.log('data:', JSON.stringify(data))
  console.log('error:', error?.message)
}
main()
