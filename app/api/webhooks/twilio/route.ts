import { sendMessage, updateConversationMessageStatusByTwilioSid, broadcastConversationStatusChange } from '@/lib/services/conversations'
import { getChatbotConfigs, clearChatbotSession } from '@/lib/services/chatbot'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ChatbotEngine } from '@/lib/chatbot-engine'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Webhook para recibir eventos de Twilio Conversations (onMessageAdded, onDeliveryUpdated)
 * Configurar en Twilio Console → Conversations → Service → Webhooks:
 *   Post-Event URL: https://tu-dominio.com/api/webhooks/twilio
 *   Events: onMessageAdded, onDeliveryUpdated
 *
 * Also supports legacy Messaging API webhooks for backward compatibility.
 *
 * Variables de entorno necesarias:
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_ACCOUNT_SID
 * - CONVERSATIONS_SERVICE_SID
 */

// Verificar firma de Twilio
function verifyTwilioSignature(req: NextRequest, formData: Record<string, FormDataEntryValue>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  // Allow disabling verification in development by setting TWILIO_SKIP_SIGNATURE=1
  if (process.env.TWILIO_SKIP_SIGNATURE === '1') return true
  if (!token) return false

  const pathname = req.nextUrl?.pathname || ''
  const search = req.nextUrl?.search || ''
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}${pathname}${search}`
    : `${req.headers.get('x-forwarded-proto') || req.headers.get('x-forwarded-protocol') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || ''}${pathname}${search}`
  const url = publicUrl
  const signature = req.headers.get('x-twilio-signature') || ''

  const keys = Object.keys(formData || {}).sort()
  let toSign = url
  for (const k of keys) {
    const v = formData[k] ?? ''
    toSign += `${k}${v}`
  }

  const computed = crypto.createHmac('sha1', token).update(toSign).digest('base64')
  if (signature !== computed) {
    // signature mismatch
  }
  return signature === computed
}

export async function POST(request: NextRequest) {
  try {
    const formDataRaw = await request.formData()
    const formData = Object.fromEntries(formDataRaw)

    // Verify Twilio signature
    const isValid = verifyTwilioSignature(request, formData)
    if (!isValid) {
      // signature verification failed
    }

    const supabase = await createClient()
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null
    const writeClient = adminSupabase || supabase

    // Detect event type: Conversations API sends EventType field
    const eventType = (formData.EventType as string) || ''

    // ─── Messaging API: Status Callback (for audio sent via Messaging API) ───
    // Audio messages are sent via client.messages.create (Messaging API) because
    // Conversations MCS doesn't support audio for WhatsApp. The status callbacks
    // come with SmsSid + MessageStatus but no EventType.
    const smsSid = (formData.SmsSid as string) || (formData.SmsMessageSid as string) || ''
    const messagingStatus = (formData.MessageStatus as string) || (formData.SmsStatus as string) || ''
    if (smsSid && !eventType && messagingStatus) {
      // This is a Messaging API status callback — update delivery status
      const mappedStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' =
        messagingStatus === 'read'
          ? 'read'
          : messagingStatus === 'delivered'
          ? 'delivered'
          : messagingStatus === 'failed' || messagingStatus === 'undelivered'
          ? 'failed'
          : messagingStatus === 'queued'
          ? 'queued'
          : 'sent'

      console.log(`[webhook] Messaging API status: SID=${smsSid} Status=${messagingStatus} → ${mappedStatus}`)

      try {
        const result = await updateConversationMessageStatusByTwilioSid(smsSid, mappedStatus, writeClient)
        if (!result.success) {
          console.warn(`[webhook] Messaging API status update failed for ${smsSid}:`, result.error)
        }
      } catch (err) {
        console.error(`[webhook] Messaging API status exception for ${smsSid}:`, err)
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    }

    // ─── Guard: reject other Messaging API payloads (SmsSid / SM...) ───
    // If the request carries a SmsSid but no EventType and no MessageStatus,
    // it comes from Programmable Messaging (e.g. incoming message duplicate). Drop it.
    if (smsSid && !eventType) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    }

    // ─────────────────────────────────────────────────────────────
    // CONVERSATIONS API: onDeliveryUpdated
    // ─────────────────────────────────────────────────────────────
    if (eventType === 'onDeliveryUpdated') {
      // Twilio Conversations sends "Status" (not "DeliveryStatus") in onDeliveryUpdated
      // Also available: ChannelMessageSid (WA.../SM...), ParticipantSid, DeliveryReceiptSid
      const messageSid = (formData.MessageSid as string) || ''
      const status = (formData.Status as string) || ''
      const channelMessageSid = (formData.ChannelMessageSid as string) || ''

      console.log(`[webhook] onDeliveryUpdated: MessageSid=${messageSid} Status=${status} ChannelMessageSid=${channelMessageSid} ParticipantSid=${(formData.ParticipantSid as string) || ''}`)

      if (messageSid && status) {
        const mappedStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' =
          status === 'read'
            ? 'read'
            : status === 'delivered'
            ? 'delivered'
            : status === 'failed' || status === 'undelivered'
            ? 'failed'
            : status === 'queued'
            ? 'queued'
            : 'sent'

        try {
          const result = await updateConversationMessageStatusByTwilioSid(messageSid, mappedStatus, writeClient)
          if (!result.success) {
            console.warn(`[webhook] onDeliveryUpdated: DB update failed for ${messageSid}:`, result.error)
          } else {
            console.log(`[webhook] onDeliveryUpdated: DB updated ${messageSid} → ${mappedStatus}`)
          }
        } catch (err) {
          console.error(`[webhook] onDeliveryUpdated: exception for ${messageSid}:`, err)
        }
      } else {
        console.warn('[webhook] onDeliveryUpdated: missing messageSid or status')
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    }

    // ─────────────────────────────────────────────────────────────
    // CONVERSATIONS API: onMessageAdded
    // ─────────────────────────────────────────────────────────────
    if (eventType === 'onMessageAdded') {
      const conversationSid = (formData.ConversationSid as string) || ''
      const author = (formData.Author as string) || ''
      const body = (formData.Body as string) || ''
      const messageSid = (formData.MessageSid as string) || ''
      const messageIndex = parseInt((formData.Index as string) || '', 10)

      // Only process Conversations API SIDs (IM... / CH...).
      // Reject any SM... SIDs that might leak through.
      if (messageSid && messageSid.startsWith('SM')) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
          { status: 200, headers: { 'Content-Type': 'application/xml' } }
        )
      }

      // Skip messages sent by our own bot/staff to avoid duplicates.
      // Staff/bot authors use identities (UUIDs, 'bot', 'staff') while
      // WhatsApp participants have addresses like 'whatsapp:+1234567890'.
      const isWhatsAppAuthor = author.startsWith('whatsapp:')
      if (!isWhatsAppAuthor) {
        // Additionally check if a message with this SID already exists in DB
        // (covers edge cases where author format is unexpected)
        if (messageSid) {
          const { data: existingMsg } = await (writeClient)
            .from('conversation_messages')
            .select('id')
            .eq('twilio_sid', messageSid)
            .maybeSingle()
          if (existingMsg) {
            return new NextResponse(
              `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
              { status: 200, headers: { 'Content-Type': 'application/xml' } }
            )
          }
        }
        // If no SID match found but author is not WhatsApp, skip
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
          { status: 200, headers: { 'Content-Type': 'application/xml' } }
        )
      }

      // Extract WhatsApp number from Author (format: whatsapp:+1234567890)
      const senderPhone = author
      const normalizedPhone = senderPhone.replace(/^whatsapp:/i, '').trim()
      const withPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`
      const noPlus = withPlus.replace(/^\+/, '')
      const digitsOnly = noPlus.replace(/\D/g, '')

      // Look up existing conversation by conversation_sid first, then by phone
      let conv: any = null

      if (conversationSid) {
        const { data: convBySid } = await (writeClient)
          .from('conversations')
          .select('id, patient_id, status')
          .eq('conversation_sid', conversationSid)
          .maybeSingle()
        conv = convBySid
      }

      if (!conv) {
        // Fallback: look up by phone number
        const convFilter = `whatsapp_number.eq.${withPlus},whatsapp_number.eq.${noPlus},whatsapp_number.eq.${digitsOnly}`
        const { data: convByPhone } = await (writeClient)
          .from('conversations')
          .select('id, patient_id, status, conversation_sid')
          .or(convFilter)
          .maybeSingle()
        conv = convByPhone
      }

      if (!conv) {
        // Find or create patient
        const patientFilter = `phone_number.eq.${withPlus},phone_number.eq.${noPlus},phone_number.eq.${digitsOnly}`
        const { data: patient } = await (writeClient)
          .from('patients')
          .select('id')
          .or(patientFilter)
          .maybeSingle()

        let patientId = patient?.id || null

        if (!patientId) {
          const { data: newPatient, error: patientInsertError } = await (writeClient)
            .from('patients')
            .insert({
              document_number: `wa-${Date.now()}`,
              full_name: 'WhatsApp user',
              phone_number: withPlus,
            })
            .select('id')
            .maybeSingle()

          if (patientInsertError) {
            throw patientInsertError
          }
          patientId = newPatient?.id || null
        }

        // Create new conversation with conversation_sid
        const { data: newConv, error: insertError } = await (writeClient)
          .from('conversations')
          .insert({
            whatsapp_number: withPlus,
            patient_id: patientId,
            status: 'nueva',
            conversation_sid: conversationSid || null,
          })
          .select('id, patient_id, status')
          .maybeSingle()

        if (insertError) {
          // Try to fetch again in case of race condition
          const convFilter = `whatsapp_number.eq.${withPlus},whatsapp_number.eq.${noPlus},whatsapp_number.eq.${digitsOnly}`
          const { data: retryConv } = await (writeClient)
            .from('conversations')
            .select('id, patient_id, status')
            .or(convFilter)
            .maybeSingle()
          conv = retryConv
        } else {
          conv = newConv
        }
      }

      // If we found a conversation but it doesn't have conversation_sid, attach it
      if (conv && conversationSid) {
        await (writeClient)
          .from('conversations')
          .update({ conversation_sid: conversationSid })
          .eq('id', conv.id)
      }

      // ── Extract media from Twilio Conversations message ──────────
      let incomingMediaUrl: string | null = null
      let incomingMediaType: string | null = null
      try {
        const mediaStr = (formData.Media as string) || ''
        const numMedia = parseInt((formData.NumMedia as string) || '0', 10)
        const mediaContentType0 = (formData.MediaContentType0 as string) || ''
        const mediaUrl0 = (formData.MediaUrl0 as string) || ''

        // Also check for MediaSid directly (some Twilio webhook versions send it)
        const directMediaSid = (formData.MediaSid as string) || ''

        // Log all media-related fields for debugging
        console.log(`[webhook] Media fields: Media=${mediaStr ? 'present' : 'empty'}, NumMedia=${numMedia}, MediaUrl0=${mediaUrl0 ? 'present' : 'empty'}, MediaSid=${directMediaSid || 'empty'}`)

        // Helper to download from Twilio MCS and upload to Supabase
        const downloadAndUploadMedia = async (mediaSid: string, contentType: string): Promise<void> => {
          const accountSid = process.env.TWILIO_ACCOUNT_SID
          const authToken = process.env.TWILIO_AUTH_TOKEN
          const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
          if (!accountSid || !authToken || !serviceSid) return

          const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
          const mcsUrl = `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media/${mediaSid}/Content`

          console.log(`[webhook] Downloading media from MCS: ${mediaSid} (${contentType})`)
          const mediaResp = await globalThis.fetch(mcsUrl, {
            headers: { 'Authorization': authHeader },
          })

          if (!mediaResp.ok) {
            console.error(`[webhook] MCS download failed: ${mediaResp.status}`)
            return
          }

          const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer())
          console.log(`[webhook] Downloaded ${mediaBuffer.length} bytes`)

          const ext = contentType?.includes('ogg') ? 'ogg'
            : contentType?.includes('mp4') ? 'mp4'
            : contentType?.includes('mpeg') ? 'mp3'
            : contentType?.includes('webm') ? 'webm'
            : contentType?.includes('amr') ? 'amr'
            : contentType?.includes('png') ? 'png'
            : contentType?.includes('jpeg') || contentType?.includes('jpg') ? 'jpg'
            : 'bin'
          const convId = conv?.id || 'unknown'
          const safeName = `${convId}/${Date.now()}.${ext}`

          const { data: uploadData, error: uploadError } = await writeClient.storage
            .from('chat-media')
            .upload(safeName, mediaBuffer, {
              contentType: contentType || 'application/octet-stream',
              upsert: false,
            })

          if (!uploadError && uploadData?.path) {
            const { data: urlData } = writeClient.storage
              .from('chat-media')
              .getPublicUrl(uploadData.path)
            incomingMediaUrl = urlData?.publicUrl || null
            console.log(`[webhook] Media uploaded to Supabase: ${incomingMediaUrl}`)
          } else if (uploadError) {
            console.error(`[webhook] Supabase upload error:`, uploadError)
          }
        }

        // Classify media type from content-type string
        const classifyMediaType = (ct: string): string => {
          if (ct?.startsWith('image/')) return 'image'
          if (ct?.startsWith('audio/')) return 'audio'
          if (ct?.startsWith('video/')) return 'video'
          return 'document'
        }

        if (mediaStr) {
          // Conversations API: Media is JSON — can be object or array
          const mediaData = JSON.parse(mediaStr)
          const mediaItems = Array.isArray(mediaData) ? mediaData : [mediaData]
          const first = mediaItems[0]

          if (first) {
            const mediaSid = first.sid || first.Sid || ''
            const contentType = first.content_type || first.ContentType || first.content_type || ''
            console.log(`[webhook] Parsed Media JSON: sid=${mediaSid}, content_type=${contentType}`)

            incomingMediaType = classifyMediaType(contentType)
            if (mediaSid) {
              await downloadAndUploadMedia(mediaSid, contentType)
            }
          }
        } else if (directMediaSid) {
          // Some webhook formats send MediaSid directly
          // Try to get content type from the Twilio API
          const accountSid = process.env.TWILIO_ACCOUNT_SID
          const authToken = process.env.TWILIO_AUTH_TOKEN
          const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
          if (accountSid && authToken && serviceSid) {
            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
            // Fetch media metadata
            const metaResp = await globalThis.fetch(
              `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media/${directMediaSid}`,
              { headers: { 'Authorization': authHeader } }
            )
            if (metaResp.ok) {
              const meta = await metaResp.json() as any
              const contentType = meta?.content_type || 'application/octet-stream'
              incomingMediaType = classifyMediaType(contentType)
              await downloadAndUploadMedia(directMediaSid, contentType)
            }
          }
        } else if (numMedia > 0 && mediaUrl0) {
          // Legacy Messaging API: MediaUrl0, MediaContentType0
          incomingMediaType = classifyMediaType(mediaContentType0)

          const accountSid = process.env.TWILIO_ACCOUNT_SID
          const authToken = process.env.TWILIO_AUTH_TOKEN
          if (accountSid && authToken) {
            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
            const mediaResp = await globalThis.fetch(mediaUrl0, {
              headers: { 'Authorization': authHeader },
            })
            if (mediaResp.ok) {
              const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer())
              const ext = mediaContentType0?.includes('ogg') ? 'ogg'
                : mediaContentType0?.includes('mp4') ? 'mp4'
                : mediaContentType0?.includes('mpeg') ? 'mp3'
                : mediaContentType0?.includes('webm') ? 'webm'
                : mediaContentType0?.includes('amr') ? 'amr'
                : mediaContentType0?.includes('png') ? 'png'
                : mediaContentType0?.includes('jpeg') || mediaContentType0?.includes('jpg') ? 'jpg'
                : 'bin'
              const convId = conv?.id || 'unknown'
              const safeName = `${convId}/${Date.now()}.${ext}`
              const { data: uploadData, error: uploadError } = await writeClient.storage
                .from('chat-media')
                .upload(safeName, mediaBuffer, {
                  contentType: mediaContentType0 || 'application/octet-stream',
                  upsert: false,
                })
              if (!uploadError && uploadData?.path) {
                const { data: urlData } = writeClient.storage
                  .from('chat-media')
                  .getPublicUrl(uploadData.path)
                incomingMediaUrl = urlData?.publicUrl || null
              }
            }
          }
        } else {
          // No media detected — also log all formData keys for investigation
          const allKeys = Object.keys(formData)
          const mediaKeys = allKeys.filter(k => /media|content|attachment/i.test(k))
          if (mediaKeys.length > 0) {
            console.log(`[webhook] Unhandled media keys:`, mediaKeys.map(k => `${k}=${String(formData[k]).substring(0, 100)}`))
          }
        }

        // Fallback: if no media detected yet but body is empty (likely a media-only message like voice note),
        // try fetching media directly from the Conversations REST API using the messageSid
        if (!incomingMediaUrl && !body && messageSid && conversationSid) {
          console.log(`[webhook] No media from formData, trying Conversations REST API for message ${messageSid}`)
          const accountSid = process.env.TWILIO_ACCOUNT_SID
          const authToken = process.env.TWILIO_AUTH_TOKEN
          const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
          if (accountSid && authToken && serviceSid) {
            const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
            // List media attached to this conversation message
            const mediaListUrl = `https://conversations.twilio.com/v1/Services/${serviceSid}/Conversations/${conversationSid}/Messages/${messageSid}/Media`
            const mediaListResp = await globalThis.fetch(mediaListUrl, {
              headers: { 'Authorization': authHeader },
            })
            if (mediaListResp.ok) {
              const mediaListData = await mediaListResp.json() as any
              const mediaItems = mediaListData?.media || []
              console.log(`[webhook] Conversations API returned ${mediaItems.length} media items`)
              if (mediaItems.length > 0) {
                const firstMedia = mediaItems[0]
                const mediaSid = firstMedia.sid
                const contentType = firstMedia.content_type || ''
                incomingMediaType = classifyMediaType(contentType)
                if (mediaSid) {
                  await downloadAndUploadMedia(mediaSid, contentType)
                }
              }
            } else {
              console.error(`[webhook] Conversations media list failed: ${mediaListResp.status}`)
            }
          }
        }
      } catch (mediaErr) {
        console.error('[webhook] Error extracting media:', mediaErr)
      }

      // Determine message text (body may be empty for media-only messages like audio)
      const hasMedia = !!incomingMediaUrl
      const defaultMediaLabel = incomingMediaType === 'audio' ? '🎤 Audio'
        : incomingMediaType === 'image' ? '📷 Imagen'
        : incomingMediaType === 'video' ? '🎬 Video'
        : hasMedia ? '📎 Archivo' : ''
      const messageText = body || (hasMedia ? defaultMediaLabel : '')

      if (conv && (messageText || hasMedia)) {
        // Save incoming message
        const createdMsg = await sendMessage(conv.id, messageText, 'patient', undefined, writeClient, incomingMediaUrl, incomingMediaType)

        // Attach twilio_sid and message_index
        if (messageSid || !isNaN(messageIndex)) {
          try {
            const updateFields: any = {}
            if (messageSid) updateFields.twilio_sid = messageSid
            if (!isNaN(messageIndex)) updateFields.message_index = messageIndex
            updateFields.delivery_status = 'delivered'

            if (createdMsg?.id) {
              await (writeClient)
                .from('conversation_messages')
                .update(updateFields)
                .eq('id', createdMsg.id)
            }
          } catch {
            // ignore
          }
        }

        // Update conversation last message
        // If conversation was closed, reset to 'nueva' and clear chatbot session
        // so the chatbot restarts from the welcome step.
        const originalStatus = conv.status
        const newStatus = originalStatus === 'cerrada' ? 'nueva' : originalStatus
        if (originalStatus === 'cerrada') {
          try {
            await clearChatbotSession(conv.id, writeClient)
          } catch {
            // ignore — session may already be cleared
          }
          conv.status = 'nueva'
        }

        await (writeClient)
          .from('conversations')
          .update({
            last_message: messageText || body,
            last_message_at: new Date().toISOString(),
            status: newStatus,
          })
          .eq('id', conv.id)

        // Broadcast status change to UI if it was reset from cerrada to nueva
        if (originalStatus === 'cerrada') {
          try {
            await broadcastConversationStatusChange(conv.id, 'nueva', writeClient)
          } catch { /* ignore */ }
        }

        // Run chatbot only if conversation is NOT being handled by an agent.
        // When en_atencion, the chatbot stays inactive so the human agent handles it.
        // When cerrada and user writes again, status is already reset to 'nueva' above.
        if (conv.status !== 'en_atencion') {
          try {
            const configs = await getChatbotConfigs(writeClient)
            const activeConfig = configs.find((cfg: any) => cfg.is_active)

            if (activeConfig) {
              const engine = new ChatbotEngine(conv.id, writeClient)
              await engine.processMessage(body, activeConfig)
            }
          } catch {
            // chatbot execution error — ignore to not block webhook response
          }
        }
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    }

    // ─────────────────────────────────────────────────────────────
    // REJECT any leftover Messaging API (SM) requests. Only
    // Conversations events (onMessageAdded / onDeliveryUpdated)
    // are handled. If we reach here, the EventType was not
    // recognised — ignore it gracefully.
    // ─────────────────────────────────────────────────────────────
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'application/xml' } }
    )
  } catch {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`,
      { status: 200, headers: { 'Content-Type': 'application/xml' } }
    )
  }
}
