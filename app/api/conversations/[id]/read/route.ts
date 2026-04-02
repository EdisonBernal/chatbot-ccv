import { markConversationMessagesRead, getConversationById, ensureStaffParticipant, ensureConversationSid } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await markConversationMessagesRead(id)

    // ── REST API fallback: advance Read Horizon with xTwilioWebhookEnabled ──
    // The frontend SDK also calls setAllMessagesRead(), but the REST API
    // with xTwilioWebhookEnabled: true explicitly tells Twilio to trigger
    // all channel-level side effects (including WhatsApp read receipts).
    //
    // IMPORTANT: This only triggers a real read receipt if lastReadMessageIndex
    // actually CHANGES. If it's already at the latest index, it's a no-op.
    try {
      const supabase = await createClient()
      const conversation = await getConversationById(id, supabase)
      const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN

      if (conversation && serviceSid && accountSid && authToken) {
        const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
          : null
        const writeClient: any = adminSupabase || supabase
        const convSid = conversation.whatsapp_number
          ? await ensureConversationSid(id, conversation.whatsapp_number, writeClient)
          : conversation.conversation_sid

        if (convSid) {
          const { data: { user } } = await supabase.auth.getUser()
          const identity = user?.id

          if (identity) {
            const participantOk = await ensureStaffParticipant(convSid, identity)
            if (participantOk) {
              const twilio = require('twilio')
              const client = twilio(accountSid, authToken)

              try {
                // Fetch latest message index from Twilio
                const twilioMessages = await client.conversations.v1
                  .services(serviceSid)
                  .conversations(convSid)
                  .messages.list({ limit: 1, order: 'desc' })

                const lastIndex = twilioMessages[0]?.index

                if (lastIndex != null) {
                  // Find our staff participant
                  const participants = await client.conversations.v1
                    .services(serviceSid)
                    .conversations(convSid)
                    .participants.list({ limit: 50 })

                  const staffParticipant = participants.find(
                    (p: any) => p.identity === identity
                  )

                  if (staffParticipant) {
                    const currentIndex = staffParticipant.lastReadMessageIndex
                    
                    // Only update if the index actually needs to advance
                    // (no-op updates won't trigger WhatsApp read receipts)
                    if (currentIndex === null || currentIndex < lastIndex) {
                      await client.conversations.v1
                        .services(serviceSid)
                        .conversations(convSid)
                        .participants(staffParticipant.sid)
                        .update({
                          lastReadMessageIndex: lastIndex,
                          xTwilioWebhookEnabled: 'true',
                        })
                    } else {
                    }
                  } else {
                    // staff participant not found
                  }
                } else {
                  // no messages
                }
              } catch {
                // ignore Twilio read horizon errors
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ status: 'ok' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
