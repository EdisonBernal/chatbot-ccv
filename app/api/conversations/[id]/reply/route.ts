import { sendMessage, getConversationById, ensureConversationSid, broadcastToConversation } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support both JSON and FormData (when images are attached)
    let body = ''
    let mediaFile: File | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = (formData.get('body') as string) || ''
      mediaFile = formData.get('media') as File | null
    } else {
      const json = await request.json()
      body = json.body || ''
    }

    if (!body.trim() && !mediaFile) {
      return NextResponse.json({ error: 'body or media required' }, { status: 400 })
    }

    const conversation = await getConversationById(id)
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = await createClient()
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null
    const writeClient: any = adminSupabase || supabase
    const { data: { user } } = await supabase.auth.getUser()

    // Map auth user id to internal users.id
    let senderDbId: string | undefined = undefined
    if (user?.id) {
      try {
        const { data: userRow, error: userRowError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()
        if (!userRowError && userRow?.id) senderDbId = userRow.id
      } catch {
        // ignore
      }
    }

    // Upload image to Supabase Storage if present
    let mediaUrl: string | null = null
    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop() || 'jpg'
      const safeName = `${id}/${Date.now()}.${ext}`
      const arrayBuffer = await mediaFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { data: uploadData, error: uploadError } = await writeClient.storage
        .from('chat-media')
        .upload(safeName, buffer, {
          contentType: mediaFile.type,
          upsert: false,
        })

      if (!uploadError && uploadData?.path) {
        const { data: urlData } = writeClient.storage
          .from('chat-media')
          .getPublicUrl(uploadData.path)
        mediaUrl = urlData?.publicUrl || null
      }
    }

    // Save message locally
    const messageText = body.trim() || (mediaUrl ? '📷 Imagen' : '')
    const message = await sendMessage(id, messageText, 'staff', senderDbId, supabase, mediaUrl)

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

          const createPayload: any = {
            author: user?.id || 'staff',
            xTwilioWebhookEnabled: 'true',
          }
          if (body.trim()) createPayload.body = body.trim()
          if (mediaUrl) createPayload.mediaSid = undefined // Not needed when using mediaUrl
          // Twilio Conversations API accepts media via mediaUrl on the message
          // For WhatsApp, we send the image URL as a media message
          if (mediaUrl) {
            // Twilio Conversations: send media via body + media attribute
            // The Conversations API doesn't directly support mediaUrl in create(),
            // so we use the REST API with media parameter
            createPayload.body = body.trim() || undefined
          }

          try {
            let twilioMsg: any
            if (mediaUrl) {
              // Use Twilio REST to send media via channel-specific attributes
              // Twilio Conversations media: upload media first, then attach to message
              // Simpler approach: send via Programmable Messaging for media, or use media attribute
              // For Conversations API: we can pass `mediaSid` if we upload to Twilio first
              // Simplest working approach: use body with media URL (WhatsApp renders link previews)
              // OR use the Twilio media upload endpoint

              // Upload media to Twilio Conversations via MCS (Media Content Service)
              const fetchFn = globalThis.fetch

              const twilioMediaUploadUrl = `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media`
              const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

              // Fetch the image from our Supabase URL and upload to Twilio MCS
              const mediaResponse = await fetchFn(mediaUrl)
              const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer())
              const mediaBlob = new Blob([mediaBuffer], { type: mediaFile!.type })

              const mcsForm = new globalThis.FormData()
              mcsForm.set('Media', mediaBlob, mediaFile!.name)

              const mcsResponse = await fetchFn(twilioMediaUploadUrl, {
                method: 'POST',
                headers: { 'Authorization': authHeader },
                body: mcsForm as any,
              })

              if (mcsResponse.ok) {
                const mcsData = await mcsResponse.json() as any
                const mediaSid = mcsData?.sid

                if (mediaSid) {
                  twilioMsg = await client.conversations.v1
                    .services(serviceSid)
                    .conversations(convSid)
                    .messages.create({
                      author: user?.id || 'staff',
                      body: body.trim() || undefined,
                      mediaSid,
                      xTwilioWebhookEnabled: 'true',
                    })
                }
              }

              // Fallback: send as body text if media upload failed
              if (!twilioMsg) {
                twilioMsg = await client.conversations.v1
                  .services(serviceSid)
                  .conversations(convSid)
                  .messages.create({
                    author: user?.id || 'staff',
                    body: body.trim() || mediaUrl,
                    xTwilioWebhookEnabled: 'true',
                  })
              }
            } else {
              twilioMsg = await client.conversations.v1
                .services(serviceSid)
                .conversations(convSid)
                .messages.create({
                  author: user?.id || 'staff',
                  body: body.trim(),
                  xTwilioWebhookEnabled: 'true',
                })
            }

            if (twilioMsg?.sid) {
              const { error: updateError } = await writeClient
                .from('conversation_messages')
                .update({
                  twilio_sid: twilioMsg.sid,
                  message_index: twilioMsg.index ?? null,
                  delivery_status: 'sent',
                })
                .eq('id', message.id)
              if (!updateError) {
                try {
                  await broadcastToConversation(id, { ...message, twilio_sid: twilioMsg.sid, message_index: twilioMsg.index ?? null, delivery_status: 'sent' }, writeClient, 'UPDATE')
                } catch { /* ignore */ }
              }
            }
          } catch (sendErr: any) {
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
                    body: body.trim() || mediaUrl || '',
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
        }
      } catch {
        // ignore Twilio errors
      }
    }

    // Update conversation last message timestamp
    await supabase
      .from('conversations')
      .update({
        last_message: messageText,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json(message, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
