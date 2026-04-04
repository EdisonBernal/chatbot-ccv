import { markConversationMessagesRead, getConversationById, ensureStaffParticipant, ensureConversationSid } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Direct HTTP call to Twilio REST API to update participant's lastReadMessageIndex.
 * We bypass the Twilio Node helper library to guarantee the X-Twilio-Webhook-Enabled
 * header is sent correctly — the helper lib may not map `xTwilioWebhookEnabled` to
 * the HTTP header properly for service-scoped endpoints.
 */
async function advanceReadHorizonDirect(
  accountSid: string,
  authToken: string,
  serviceSid: string,
  convSid: string,
  participantSid: string,
  lastReadMessageIndex: number
): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `https://conversations.twilio.com/v1/Services/${serviceSid}/Conversations/${convSid}/Participants/${participantSid}`
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const params = new URLSearchParams()
  params.set('LastReadMessageIndex', String(lastReadMessageIndex))

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Webhook-Enabled': 'true',
    },
    body: params.toString(),
  })

  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await markConversationMessagesRead(id)

    // ── REST API: advance Read Horizon with explicit X-Twilio-Webhook-Enabled header ──
    // Uses a direct HTTP call (not the Twilio SDK) to guarantee the header is sent.
    // Without this header, Twilio updates the index internally but does NOT relay
    // the read receipt to WhatsApp (no blue checks).
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
                    
                    if (currentIndex === null || currentIndex < lastIndex) {
                      console.log(`[read] Advancing read horizon via direct HTTP: convSid=${convSid} identity=${identity} participantSid=${staffParticipant.sid} ${currentIndex} → ${lastIndex}`)
                      
                      const result = await advanceReadHorizonDirect(
                        accountSid,
                        authToken,
                        serviceSid,
                        convSid,
                        staffParticipant.sid,
                        lastIndex
                      )

                      if (result.ok) {
                        console.log(`[read] ✓ Read horizon advanced — Twilio returned ${result.status}, lastReadMessageIndex=${result.body?.last_read_message_index}`)
                      } else {
                        console.error(`[read] ✗ Twilio returned ${result.status}:`, JSON.stringify(result.body))
                      }
                    } else {
                      console.log(`[read] Read horizon already at latest: currentIndex=${currentIndex} lastIndex=${lastIndex}`)
                    }
                  } else {
                    console.warn(`[read] Staff participant not found: identity=${identity} convSid=${convSid}`)
                  }
                } else {
                  console.log('[read] No messages in Twilio conversation')
                }
              } catch (twilioErr) {
                console.error('[read] Twilio read horizon error:', twilioErr)
              }
            } else {
              console.warn(`[read] ensureStaffParticipant failed: convSid=${convSid} identity=${identity}`)
            }
          } else {
            console.warn('[read] No authenticated user identity')
          }
        } else {
          console.warn(`[read] Could not resolve convSid for conversation ${id}`)
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
