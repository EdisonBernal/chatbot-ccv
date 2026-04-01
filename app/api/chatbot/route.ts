import { getChatbotConfigs, createChatbotConfig } from '@/lib/services/chatbot'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const configs = await getChatbotConfigs()
    return NextResponse.json(configs)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await request.json()
    // Check if the authenticated user is an admin in the users table
    let isAdmin = false
    try {
      const { data: userRow, error: userRowError } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single()
      if (!userRowError && userRow?.role === 'admin') isAdmin = true
    } catch (e) {
      // ignore lookup errors and fall back to policy-based access
    }

    if (isAdmin) {
      // If we have a service role key available, use it to bypass RLS for admin actions
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
      }

      const svc = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
      const { data, error } = await svc
        .from('chatbot_config')
        .insert({ ...body, created_by: user.id })
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // Non-admins: fall back to normal creation which relies on RLS policies
    const config = await createChatbotConfig(body, user.id)
    return NextResponse.json(config, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
