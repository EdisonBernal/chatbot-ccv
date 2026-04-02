import { sendMessage, getConversationById, ensureConversationSid, broadcastToConversation } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { body } = await request.json()
    if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

    const conversation = await getConversationById(id)
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = await createClient()
    // create admin client if service role key available
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null
    const writeClient: any = adminSupabase || supabase
    const { data: { user } } = await supabase.auth.getUser()

    // Map auth user id to internal users.id (auth_id -> users.auth_id)
    let senderDbId: string | undefined = undefined
    if (user?.id) {
      try {
        const { data: userRow, error: userRowError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()
        if (!userRowError && userRow?.id) senderDbId = userRow.id
      } catch (mapErr) {
        // ignore
      }
    }

    // Save message locally first
    const message = await sendMessage(id, body.trim(), 'staff', senderDbId, supabase)

    // Send via Twilio Conversations API
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const serviceSid = process.env.CONVERSATIONS_SERVICE_SID

    if (accountSid && authToken && serviceSid) {
      if (!conversation.whatsapp_number) {
        return NextResponse.json({ error: 'Conversation has no whatsapp number' }, { status: 400 })
      }

      try {
        let convSid = await ensureConversationSid(id, conversation.whatsapp_number, writeClient)

        if (convSid) {
          const twilio = require('twilio')
          const client = twilio(accountSid, authToken)

          try {
            const twilioMsg = await client.conversations.v1
              .services(serviceSid)
              .conversations(convSid)
              .messages.create({
                author: user?.id || 'staff',
                body: body.trim(),
                xTwilioWebhookEnabled: 'true',
              })

            // Update DB record with Twilio message SID, index, and mark as 'sent'
            // since Twilio accepted the message (moves from queued → sent immediately)
            if (twilioMsg?.sid) {
              const { error: updateError } = await writeClient
                .from('conversation_messages')
                .update({
                  twilio_sid: twilioMsg.sid,
                  message_index: twilioMsg.index ?? null,
                  delivery_status: 'sent',
                })
                .eq('id', message.id)
              if (updateError) {
                // ignore — twilio_sid not saved to DB
              } else {
                // Broadcast the status update so the UI reflects 'sent' immediately
                try {
                  await broadcastToConversation(id, { ...message, twilio_sid: twilioMsg.sid, message_index: twilioMsg.index ?? null, delivery_status: 'sent' }, writeClient, 'UPDATE')
                } catch (_) { /* ignore */ }
              }
            }
          } catch (sendErr: any) {
            // If 404, the conversation SID was stale even after ensureConversationSid
            // (e.g. race condition). Clear it and retry once.
            if (sendErr?.status === 404 || sendErr?.code === 20404) {
              await writeClient
                .from('conversations')
                .update({ conversation_sid: null })
                .eq('id', id)
              const retrySid = await ensureConversationSid(id, conversation.whatsapp_number, writeClient)
              if (retrySid) {
                const retryMsg = await client.conversations.v1
                  .services(serviceSid)
                  .conversations(retrySid)
                  .messages.create({
                    author: user?.id || 'staff',
                    body: body.trim(),
                    xTwilioWebhookEnabled: 'true',
                  })
                if (retryMsg?.sid) {
                  await writeClient
                    .from('conversation_messages')
                    .update({ twilio_sid: retryMsg.sid, message_index: retryMsg.index ?? null, delivery_status: 'sent' })
                    .eq('id', message.id)
                }
              }
            } else {
              throw sendErr
            }
          }
        } else {
          // no convSid
        }
      } catch {
        // ignore Twilio errors
      }
    }

    // Update conversation last message timestamp
    await supabase
      .from('conversations')
      .update({
        last_message: body.trim(),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json(message, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
