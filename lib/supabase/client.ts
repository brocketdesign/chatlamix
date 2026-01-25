import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // During build time, these might not be available - return a mock or handle gracefully
  if (!url || !key) {
    throw new Error(
      "Supabase URL and anon key are required. " +
      "Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    )
  }
  
  return createBrowserClient(url, key)
}
