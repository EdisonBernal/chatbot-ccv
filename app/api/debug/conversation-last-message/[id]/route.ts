import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Dev-only diagnostic endpoint to fetch the last staff message for a conversation
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Prevent accidental exposure in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, message_text, twilio_sid, delivery_status, created_at')
      .eq('conversation_id', id)
      .eq('sender_type', 'staff')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[debug] conversation-last-message error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || null)
  } catch (e: unknown) {
    console.error('[debug] conversation-last-message exception', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
