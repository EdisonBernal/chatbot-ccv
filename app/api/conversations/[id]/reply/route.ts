import { sendMessage, getConversationById, broadcastToConversation } from '@/lib/services/conversations'
import { convertAudioForWhatsApp } from '@/lib/convert-audio'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Support both JSON and FormData (when images are attached)
    let body = ''
    let mediaFile: File | null = null
    let replyToMessageId: string | null = null
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = (formData.get('body') as string) || ''
      mediaFile = formData.get('media') as File | null
      replyToMessageId = (formData.get('replyToMessageId') as string) || null
    } else {
      const json = await request.json()
      body = json.body || ''
      replyToMessageId = json.replyToMessageId || null
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

      // Convert audio to MP3 before storing (WhatsApp compatible)
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
    const message = await sendMessage(id, messageText, 'staff', senderDbId, supabase, mediaUrl, mediaType, replyToMessageId)

    // If replying to a message, fetch the replied message for the response
    let replyWamid: string | null = null
    if (replyToMessageId) {
      const { data: repliedMsg } = await writeClient
        .from('conversation_messages')
        .select('id, message_text, sender_type, media_type, media_url, twilio_sid')
        .eq('id', replyToMessageId)
        .single()
      if (repliedMsg) {
        (message as any).replied_message = repliedMsg
        if (repliedMsg.twilio_sid) replyWamid = repliedMsg.twilio_sid
      }
    }

    // ── Send via WhatsApp Cloud API (fire-and-forget after response) ──
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (phoneNumberId && accessToken && conversation.whatsapp_number) {
      const normalized = conversation.whatsapp_number.replace(/^whatsapp:/i, '').trim()
      const digits = (normalized.startsWith('+') ? normalized : `+${normalized}`).replace(/^\+/, '')

      // Use after() so the response is sent immediately while WA send happens in background
      after(async () => {
        try {
          let waMessageId: string | null = null

          if (mediaUrl && mediaType === 'audio') {
            const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: digits,
                type: 'audio',
                audio: { link: mediaUrl },
                ...(replyWamid ? { context: { message_id: replyWamid } } : {}),
              }),
            })
            if (resp.ok) {
              const data = await resp.json() as any
              waMessageId = data?.messages?.[0]?.id || null
            } else {
              console.error('[reply] WA audio send failed:', resp.status, await resp.text())
            }
          } else if (mediaUrl && mediaType === 'image') {
            const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: digits,
                type: 'image',
                image: {
                  link: mediaUrl,
                  ...(body.trim() ? { caption: body.trim() } : {}),
                },
                ...(replyWamid ? { context: { message_id: replyWamid } } : {}),
              }),
            })
            if (resp.ok) {
              const data = await resp.json() as any
              waMessageId = data?.messages?.[0]?.id || null
            } else {
              console.error('[reply] WA image send failed:', resp.status, await resp.text())
            }
          } else if (mediaUrl && (mediaType === 'video' || mediaType === 'document')) {
            const waType = mediaType === 'video' ? 'video' : 'document'
            const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: digits,
                type: waType,
                [waType]: {
                  link: mediaUrl,
                  ...(body.trim() ? { caption: body.trim() } : {}),
                },
                ...(replyWamid ? { context: { message_id: replyWamid } } : {}),
              }),
            })
            if (resp.ok) {
              const data = await resp.json() as any
              waMessageId = data?.messages?.[0]?.id || null
            } else {
              console.error(`[reply] WA ${waType} send failed:`, resp.status, await resp.text())
            }
          } else if (body.trim()) {
            const resp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: digits,
                type: 'text',
                text: { body: body.trim() },
                ...(replyWamid ? { context: { message_id: replyWamid } } : {}),
              }),
            })
            if (resp.ok) {
              const data = await resp.json() as any
              waMessageId = data?.messages?.[0]?.id || null
            } else {
              console.error('[reply] WA text send failed:', resp.status, await resp.text())
            }
          }

          if (waMessageId) {
            // Save twilio_sid and set status to 'sent'
            const adminSb = createSupabaseAdmin(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            )
            const { error: updateError } = await adminSb
              .from('conversation_messages')
              .update({
                twilio_sid: waMessageId,
                delivery_status: 'sent',
              })
              .eq('id', message.id)
            if (!updateError) {
              try {
                await broadcastToConversation(id, { ...message, twilio_sid: waMessageId, delivery_status: 'sent' }, adminSb, 'UPDATE')
              } catch { /* ignore */ }
            }

            // Update conversation last message timestamp
            await adminSb
              .from('conversations')
              .update({
                last_message: messageText,
                last_message_at: new Date().toISOString(),
              })
              .eq('id', id)
          } else {
            // WhatsApp send failed — mark as failed
            const adminSb = createSupabaseAdmin(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            )
            await adminSb
              .from('conversation_messages')
              .update({ delivery_status: 'failed' })
              .eq('id', message.id)
            try {
              await broadcastToConversation(id, { ...message, delivery_status: 'failed' }, adminSb, 'UPDATE')
            } catch { /* ignore */ }
          }
        } catch (err) {
          console.error('[reply] WhatsApp send error:', err)
        }
      })
    } else {
      // No WhatsApp configured — just update conversation timestamp
      after(async () => {
        try {
          const adminSb = process.env.SUPABASE_SERVICE_ROLE_KEY
            ? createSupabaseAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
            : null
          const wc: any = adminSb || supabase
          await wc
            .from('conversations')
            .update({
              last_message: messageText,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', id)
        } catch { /* ignore */ }
      })
    }

    return NextResponse.json(message, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}