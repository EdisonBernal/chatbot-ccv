import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/conversations/[id]/played
 * 
 * Sends a WhatsApp "played" receipt for a specific voice message.
 * This makes the blue microphone icon appear on the patient's phone
 * when staff listens to their audio in the dashboard.
 * 
 * Body: { messageId: string } — the DB message ID of the audio that was played
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!accessToken || !phoneNumberId) {
      return NextResponse.json({ status: 'no-wa-config' })
    }

    const supabase = await createClient()
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null
    const readClient = adminSupabase || supabase

    // Get the WhatsApp message ID (twilio_sid) for this audio message
    const { data: msg, error: queryError } = await readClient
      .from('conversation_messages')
      .select('twilio_sid, sender_type, media_type')
      .eq('id', messageId)
      .eq('conversation_id', id)
      .single()

    if (queryError || !msg) {
      return NextResponse.json({ status: 'not-found' })
    }

    // Only send "played" for patient audio messages
    if (msg.sender_type !== 'patient' || msg.media_type !== 'audio') {
      return NextResponse.json({ status: 'not-applicable' })
    }

    if (!msg.twilio_sid) {
      console.log(`[played] No twilio_sid for message ${messageId}`)
      return NextResponse.json({ status: 'no-wamid' })
    }

    // Send "read" receipt which is the only status the Cloud API supports
    // This triggers the blue checkmarks; unfortunately the Cloud API does not
    // have a dedicated "played" status for voice messages.
    console.log(`[played] Sending read receipt for audio wamid=${msg.twilio_sid} (conv=${id})`)
    const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: msg.twilio_sid,
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '')
      console.error(`[played] WA read receipt failed: ${resp.status} ${errBody}`)
      return NextResponse.json({ status: 'wa-error' })
    }

    console.log(`[played] Read receipt sent for audio wamid=${msg.twilio_sid}`)
    return NextResponse.json({ status: 'ok' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
