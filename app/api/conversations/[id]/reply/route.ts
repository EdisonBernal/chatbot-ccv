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
        console.warn('[v0] Could not map auth user to users table', mapErr)
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
              })

            // Update DB record with Twilio message SID and index
            if (twilioMsg?.sid) {
              const { error: updateError } = await writeClient
                .from('conversation_messages')
                .update({
                  twilio_sid: twilioMsg.sid,
                  message_index: twilioMsg.index ?? null,
                })
                .eq('id', message.id)
              if (updateError) {
                console.error('[v0] Failed to save twilio_sid to DB', { messageId: message.id, sid: twilioMsg.sid, error: updateError })
              }
            }
          } catch (sendErr: any) {
            // If 404, the conversation SID was stale even after ensureConversationSid
            // (e.g. race condition). Clear it and retry once.
            if (sendErr?.status === 404 || sendErr?.code === 20404) {
              console.warn('[v0] Conversation 404 on send, clearing SID and retrying', { convSid })
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
                  })
                if (retryMsg?.sid) {
                  await writeClient
                    .from('conversation_messages')
                    .update({ twilio_sid: retryMsg.sid, message_index: retryMsg.index ?? null })
                    .eq('id', message.id)
                }
              }
            } else {
              throw sendErr
            }
          }
        } else {
          console.warn('[v0] Could not obtain conversation_sid, message saved locally only')
        }
      } catch (twilioError) {
        console.error('[v0] Twilio Conversations error:', twilioError)
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
    console.error('[v0] Error in reply route:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
