import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: conversation } = await supabase
      .from('conversations')
      .select('whatsapp_number')
      .eq('id', id)
      .single()

    if (!conversation?.whatsapp_number) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: lastMsg } = await supabase
      .from('conversation_messages')
      .select('twilio_sid')
      .eq('conversation_id', id)
      .eq('sender_type', 'patient')
      .not('twilio_sid', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastMsg?.twilio_sid) {
      return NextResponse.json({ ok: false, reason: 'no_wamid' })
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ ok: false, reason: 'no_config' })
    }

    const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: lastMsg.twilio_sid,
        typing_indicator: { type: 'text' },
      }),
    })

    if (!resp.ok) {
      console.error('[typing] WhatsApp typing failed:', resp.status)
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[typing] Error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
