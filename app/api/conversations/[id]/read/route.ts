import { markConversationMessagesRead } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await markConversationMessagesRead(id)

    // Send read receipts to WhatsApp for unread patient messages
    // so the patient sees blue checks when the agent opens the conversation.
    try {
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
      if (accessToken && phoneNumberId) {
        const supabase = await createClient()
        const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
          : null
        const readClient = adminSupabase || supabase

        // Get recent patient messages that have a WhatsApp message ID
        const { data: recentMsgs } = await readClient
          .from('conversation_messages')
          .select('twilio_sid')
          .eq('conversation_id', id)
          .eq('sender_type', 'patient')
          .not('twilio_sid', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10)

        if (recentMsgs?.length) {
          // Send read receipt for the most recent message (WhatsApp marks all prior as read too)
          const lastWaId = recentMsgs[0].twilio_sid
          if (lastWaId) {
            await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: lastWaId,
              }),
            })
          }
        }
      }
    } catch {
      // ignore — read receipt is best-effort
    }

    return NextResponse.json({ status: 'ok' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}