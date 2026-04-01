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

    // Use Twilio Conversations Read Horizon to signal WhatsApp
    // that messages have been read (triggers blue check marks).
    //
    // IMPORTANT: The REST API update needs xTwilioWebhookEnabled so Twilio
    // treats it as a full "participant action" and sends the WhatsApp read
    // receipt back. Without this header, REST API calls are silent and do NOT
    // trigger channel-side effects like WhatsApp blue checks.
    //
    // Also verify in Twilio Console → Conversations → Service → Settings:
    //   - "Read Status" must be enabled
    //   - Post-Event webhook must include onDeliveryUpdated
    try {
      const supabase = await createClient()
      const conversation = await getConversationById(id, supabase)
      const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN

      if (conversation && serviceSid && accountSid && authToken) {
        // Get a validated conversation SID (handles stale/404 SIDs)
        const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
          : null
        const writeClient: any = adminSupabase || supabase
        const convSid = conversation.whatsapp_number
          ? await ensureConversationSid(id, conversation.whatsapp_number, writeClient)
          : conversation.conversation_sid

        if (!convSid) {
          // No valid Twilio conversation — skip Read Horizon silently
          return NextResponse.json({ status: 'ok' })
        }

        // Get the authenticated user identity
        const { data: { user } } = await supabase.auth.getUser()
        const identity = user?.id

        if (identity) {
          // Ensure the staff user is a participant in this conversation
          const participantOk = await ensureStaffParticipant(convSid, identity)
          if (!participantOk) {
            // Conversation may no longer exist — skip Read Horizon
            return NextResponse.json({ status: 'ok' })
          }

          const twilio = require('twilio')
          const client = twilio(accountSid, authToken)

          try {
            // Fetch the latest message index directly from Twilio (more reliable
            // than using the DB which may have null/stale indexes).
            const twilioMessages = await client.conversations.v1
              .services(serviceSid)
              .conversations(convSid)
              .messages.list({ limit: 1, order: 'desc' })

            const lastIndex = twilioMessages[0]?.index

            if (lastIndex != null) {
              const participants = await client.conversations.v1
                .services(serviceSid)
                .conversations(convSid)
                .participants.list({ limit: 50 })

              const staffParticipant = participants.find(
                (p: any) => p.identity === identity
              )

              if (staffParticipant) {
                // Include xTwilioWebhookEnabled so the Read Horizon update is
                // published as a full event, which triggers WhatsApp read receipts.
                await client.conversations.v1
                  .services(serviceSid)
                  .conversations(convSid)
                  .participants(staffParticipant.sid)
                  .update({
                    lastReadMessageIndex: lastIndex,
                    xTwilioWebhookEnabled: 'true',
                  })
                console.log('[read] Read Horizon advanced to index', lastIndex, 'for participant', staffParticipant.sid)
              } else {
                console.warn('[read] Staff participant not found for identity', identity)
              }
            } else {
              console.warn('[read] No messages found in Twilio conversation', convSid)
            }
          } catch (readError: any) {
            if (readError?.status === 404 || readError?.code === 20404) {
              console.warn('[read] Conversation no longer exists in Twilio, skipping Read Horizon')
            } else {
              console.warn('[read] Error advancing Read Horizon:', readError)
            }
          }
        }
      }
    } catch (e) {
      console.warn('[read] Error updating Read Horizon:', e)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
