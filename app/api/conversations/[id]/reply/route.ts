import { sendMessage, getConversationById, ensureConversationSid, broadcastToConversation } from '@/lib/services/conversations'
import { convertAudioForWhatsApp } from '@/lib/convert-audio'
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

    // Upload media to Supabase Storage if present
    // For audio: convert to MP3 before uploading (reliable format for Twilio Sandbox)
    let mediaUrl: string | null = null
    let mediaType: string | null = null
    if (mediaFile) {
      const arrayBuffer = await mediaFile.arrayBuffer()
      let buffer = Buffer.from(arrayBuffer)
      let uploadContentType = mediaFile.type
      let ext = mediaFile.name.split('.').pop() || 'bin'

      // Determine media type from MIME
      if (mediaFile.type.startsWith('image/')) mediaType = 'image'
      else if (mediaFile.type.startsWith('audio/')) mediaType = 'audio'
      else if (mediaFile.type.startsWith('video/')) mediaType = 'video'
      else mediaType = 'document'

      // Convert audio to MP3 before storing (Twilio Sandbox compatible)
      if (mediaType === 'audio') {
        const converted = await convertAudioForWhatsApp(buffer, mediaFile.type)
        buffer = Buffer.from(converted.buffer)
        uploadContentType = converted.contentType
        ext = converted.extension
      }

      const safeName = `${id}/${Date.now()}.${ext}`

      const { data: uploadData, error: uploadError } = await writeClient.storage
        .from('chat-media')
        .upload(safeName, buffer, {
          contentType: uploadContentType,
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
    const defaultLabel = mediaType === 'audio' ? '🎤 Audio' : mediaType === 'image' ? '📷 Imagen' : mediaUrl ? '📎 Archivo' : ''
    const messageText = body.trim() || (mediaUrl ? defaultLabel : '')
    const message = await sendMessage(id, messageText, 'staff', senderDbId, supabase, mediaUrl, mediaType)

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
            let twilioMsg: any
            if (mediaUrl && mediaType === 'audio') {
              // Audio: use Twilio Messaging API (Conversations MCS doesn't support audio for WhatsApp)
              const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER
              if (whatsappNumber) {
                const from = whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`
                const to = conversation.whatsapp_number!.startsWith('whatsapp:')
                  ? conversation.whatsapp_number!
                  : `whatsapp:${conversation.whatsapp_number}`

                const msgResult = await client.messages.create({
                  from,
                  to,
                  mediaUrl: [mediaUrl],
                  ...(body.trim() ? { body: body.trim() } : {}),
                  statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`,
                })
                twilioMsg = { sid: msgResult.sid, index: null }
              }
            } else if (mediaUrl) {
              // Images/other media: upload to Twilio MCS then send via Conversations API
              const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
              const mediaResponse = await globalThis.fetch(mediaUrl)
              const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer())

              const mediaBlob = new Blob([new Uint8Array(mediaBuffer)], { type: mediaFile!.type })
              const mcsForm = new globalThis.FormData()
              mcsForm.set('Media', mediaBlob, mediaFile!.name)

              const mcsResponse = await globalThis.fetch(
                `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media`,
                { method: 'POST', headers: { 'Authorization': authHeader }, body: mcsForm as any }
              )

              if (mcsResponse.ok) {
                const mcsData = await mcsResponse.json() as any
                if (mcsData?.sid) {
                  twilioMsg = await client.conversations.v1
                    .services(serviceSid)
                    .conversations(convSid)
                    .messages.create({
                      author: user?.id || 'staff',
                      body: body.trim() || undefined,
                      mediaSid: mcsData.sid,
                      xTwilioWebhookEnabled: 'true',
                    })
                }
              }

              // Fallback: send media URL as text
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
