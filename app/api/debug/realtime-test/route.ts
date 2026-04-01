import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const conversationId = body.conversation_id
    const text = body.message || 'test realtime message'

    if (!conversationId) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'supabase env not configured' }, { status: 500 })
    }

    const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data, error } = await admin
      .from('conversation_messages')
      .insert({ conversation_id: conversationId, message_text: text, sender_type: 'patient' })
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 500 })

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
