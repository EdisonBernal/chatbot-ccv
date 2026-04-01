import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Debug: indicate in browser console whether the public URL/key are present.
  try {
    // eslint-disable-next-line no-console
    console.log('[supabase-client] createClient called, NEXT_PUBLIC_SUPABASE_URL present?', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    // eslint-disable-next-line no-console
    console.log('[supabase-client] NEXT_PUBLIC_SUPABASE_ANON_KEY present?', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  } catch (e) {
    // ignore in non-browser envs
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Expose the client for debugging in the browser (non-production only)
  try {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // @ts-ignore
      window.__supabase_client = client
      // eslint-disable-next-line no-console
      console.log('[supabase-client] exposed window.__supabase_client for debugging')
    }
  } catch (e) {
    // ignore errors exposing to window
  }

  return client
}
