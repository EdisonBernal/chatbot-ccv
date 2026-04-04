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

    // ─── Guard: reject Messaging API payloads (SmsSid / SM...) ───
    // If the request carries a SmsSid but no Conversations EventType,
    // it comes from Programmable Messaging, not Conversations. Drop it
    // to prevent duplicate messages.
    const smsSid = (formData.SmsSid as string) || (formData.SmsMessageSid as string) || ''
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

      if (conv && body) {
        // Save incoming message
        const createdMsg = await sendMessage(conv.id, body, 'patient', undefined, writeClient)

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
            last_message: body,
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
