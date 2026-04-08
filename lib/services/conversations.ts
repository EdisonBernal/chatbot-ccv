import { createClient } from '@/lib/supabase/server'
// dynamic import used below to create admin client when available
import type { Conversation, ConversationMessage, ConversationFormData } from '@/lib/types'

export async function getConversations(status?: string): Promise<Conversation[]> {
  const supabase = await createClient()
  let query = supabase
    .from('conversations')
    .select(`*, patient:patients(*), appointment_request:appointment_requests(*, specialty:specialties(*))`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  const conversations = (data as Conversation[]) || []

  // Compute unread counts per conversation: count only messages from the patient
  try {
    if (conversations.length > 0) {
      await Promise.all(
        conversations.map(async (conv) => {
          try {
            const cutoff = conv.last_view_at ?? '1970-01-01T00:00:00Z'
            const { count, error } = await supabase
              .from('conversation_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('sender_type', 'patient')
              .gt('created_at', cutoff)

            if (!error) {
              conv.unread_count = typeof count === 'number' ? count : 0
            } else {
              // fallback conservative 0/1
              if (!conv.last_message_at) conv.unread_count = 0
              else if (!conv.last_view_at) conv.unread_count = 1
              else conv.unread_count = new Date(conv.last_message_at) > new Date(conv.last_view_at) ? 1 : 0
            }
          } catch (_e) {
            if (!conv.last_message_at) conv.unread_count = 0
            else if (!conv.last_view_at) conv.unread_count = 1
            else conv.unread_count = new Date(conv.last_message_at) > new Date(conv.last_view_at) ? 1 : 0
          }
        })
      )
    }
  } catch (e) {
    // On any failure, ensure conversations still return and have a 0/1 fallback
    for (const conv of conversations) {
      if (!conv.last_message_at) conv.unread_count = 0
      else if (!conv.last_view_at) conv.unread_count = 1
      else conv.unread_count = new Date(conv.last_message_at) > new Date(conv.last_view_at) ? 1 : 0
    }
  }

  return conversations
}

export async function getConversationById(id: string, supabaseClient?: any): Promise<Conversation | null> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select(`*, patient:patients(*, eps:eps(*)), appointment_request:appointment_requests(*, specialty:specialties(*))`)
    .eq('id', id)
    .single()
  if (error) return null
  return data as Conversation
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversation_messages')
    .select(`*, sender:users(*)`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ConversationMessage[]) || []
}

export async function createConversation(formData: ConversationFormData): Promise<Conversation> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .insert({ ...formData, status: 'nueva' })
    .select(`*, patient:patients(*)`)
    .single()
  if (error) throw error
  return data as Conversation
}

export async function updateConversationStatus(id: string, status: string): Promise<Conversation> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', id)
    .select(`*, patient:patients(*)`)
    .single()
  if (error) throw error
  return data as Conversation
}

export async function linkConversationToAppointment(
  conversationId: string,
  appointmentId: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ appointment_request_id: appointmentId })
    .eq('id', conversationId)
  if (error) throw error
}

export async function updateConversation(
  id: string,
  updates: Partial<{ status: string; patient_id: string | null }>
): Promise<Conversation> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select(`*, patient:patients(*, eps:eps(*)), appointment_request:appointment_requests(*, specialty:specialties(*))`)
    .single()
  if (error) throw error
  return data as Conversation
}

/**
 * Broadcast helper: sends a user-broadcast to the conversation topic so realtime clients
 * subscribed to `topic:conversation:<id>` receive the payload immediately.
 * This is best-effort and will not throw on failure.
 */
export async function broadcastToConversation(
  conversationId: string,
  payload: any,
  supabaseClient?: any,
  eventType: 'INSERT' | 'UPDATE' = 'INSERT'
): Promise<{ success: boolean; error?: any }> {
  const supabase = supabaseClient || (await createClient())
  try {
    const topic = `topic:conversation:${conversationId}`
    const channel: any = supabase.channel(topic)
    try {
      // Prefer explicit httpSend() to avoid realtime fallback warning
      // Ensure payload is defined to avoid SDK httpSend payload errors
      const safePayload = payload === undefined ? {} : payload
      const message = { type: 'broadcast', event: eventType, payload: safePayload }

      // If the channel exposes httpSend directly, use it and pass (event, payload).
      const eventName = message.event || 'INSERT'
      const payloadArg = message.payload
      if (channel && typeof channel.httpSend === 'function') {
        try {
          // @ts-ignore
          await channel.httpSend(eventName, payloadArg)
        } catch (e) {
          throw e
        }
      } else if (channel && typeof channel.send === 'function') {
        // Call send with the message. Some SDKs return an object with an httpSend
        // method when calling send(message). Handle both possibilities.
        // @ts-ignore
        const sendResult = channel.send(message)
        // If sendResult is a promise, await it first to get the returned value.
        const resolved = sendResult && typeof sendResult.then === 'function' ? await sendResult : sendResult
        if (resolved && typeof resolved.httpSend === 'function') {
          // Ensure we pass (event, payload) to httpSend as well
          try {
            await resolved.httpSend(eventName, payloadArg)
          } catch (e) {
            throw e
          }
        }
      }
    } finally {
      try { await supabase.removeChannel(channel) } catch (e) { /* ignore */ }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err }
  }
}

/**
 * Broadcast a conversation status change to the global topic so all UI
 * clients update the conversation status in realtime.
 */
export async function broadcastConversationStatusChange(
  conversationId: string,
  status: string,
  supabaseClient?: any,
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  try {
    const topic = 'topic:conversations'
    const channel: any = supabase.channel(topic, { config: { private: true } })
    const payload = { conversation_id: conversationId, status }
    try {
      if (channel && typeof channel.httpSend === 'function') {
        await channel.httpSend('STATUS_CHANGE', payload)
      } else if (channel && typeof channel.send === 'function') {
        const sendResult = channel.send({ type: 'broadcast', event: 'STATUS_CHANGE', payload })
        const resolved = sendResult && typeof sendResult.then === 'function' ? await sendResult : sendResult
        if (resolved && typeof resolved.httpSend === 'function') {
          await resolved.httpSend('STATUS_CHANGE', payload)
        }
      }
    } finally {
      try { await supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  } catch {
    // ignore broadcast failures
  }
}

/**
 * Broadcast that a new conversation was created so all UI clients can fetch it.
 */
export async function broadcastNewConversation(
  conversationId: string,
  supabaseClient?: any,
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  try {
    const topic = 'topic:conversations'
    const channel: any = supabase.channel(topic, { config: { private: true } })
    const payload = { conversation_id: conversationId }
    console.log(`[broadcast] NEW_CONVERSATION → ${topic} (private) convId=${conversationId}`)
    try {
      if (channel && typeof channel.httpSend === 'function') {
        await channel.httpSend('NEW_CONVERSATION', payload)
        console.log(`[broadcast] NEW_CONVERSATION sent via httpSend`)
      } else if (channel && typeof channel.send === 'function') {
        const sendResult = channel.send({ type: 'broadcast', event: 'NEW_CONVERSATION', payload })
        const resolved = sendResult && typeof sendResult.then === 'function' ? await sendResult : sendResult
        if (resolved && typeof resolved.httpSend === 'function') {
          await resolved.httpSend('NEW_CONVERSATION', payload)
          console.log(`[broadcast] NEW_CONVERSATION sent via resolved.httpSend`)
        } else {
          console.log(`[broadcast] NEW_CONVERSATION sent via channel.send`)
        }
      } else {
        console.warn(`[broadcast] No httpSend or send method on channel`)
      }
    } finally {
      try { await supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  } catch (err) {
    console.error(`[broadcast] NEW_CONVERSATION failed:`, err)
  }
}

export async function sendMessage(
  conversationId: string,
  messageText: string,
  senderType: 'patient' | 'staff',
  senderId?: string,
  supabaseClient?: any,
  mediaUrl?: string | null,
  mediaType?: string | null,
  replyToMessageId?: string | null,
): Promise<ConversationMessage> {
  const supabase = supabaseClient || (await createClient())
  const insertPayload: any = {
    conversation_id: conversationId,
    message_text: messageText,
    sender_type: senderType,
    sender_id: senderId || null,
    // When a staff message is created we'll mark it as 'queued' by default
    // so the webhook/status callbacks can move it to sent/delivered/read.
    delivery_status: senderType === 'staff' ? 'queued' : 'read',
  }
  if (mediaUrl) insertPayload.media_url = mediaUrl
  if (mediaType) insertPayload.media_type = mediaType
  if (replyToMessageId) insertPayload.reply_to_message_id = replyToMessageId

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert(insertPayload)
    .select(`*, sender:users(*)`)
    .single()
  if (error) throw error
  // Best-effort broadcast to realtime subscribers
  try {
    await broadcastToConversation(conversationId, data, supabase)
  } catch (bErr) {
    // ignore broadcast failures
  }

  return data as ConversationMessage
}

export async function updateConversationMessageStatus(
  messageId: string,
  deliveryStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  supabaseClient?: any
): Promise<ConversationMessage> {
  const supabase = supabaseClient || (await createClient())
  const { data, error } = await supabase
    .from('conversation_messages')
    .update({ delivery_status: deliveryStatus })
    .eq('id', messageId)
    .select(`*, sender:users(*)`)
    .single()
  if (error) throw error
  try {
    const conversationId = (data as any)?.conversation_id
    if (conversationId) {
      try {
        await broadcastToConversation(conversationId, data, supabase)
      } catch (bErr) {
        // ignore
      }
    }
  } catch (bErr) {
    // ignore
  }

  return data as ConversationMessage
}

export async function markConversationMessagesRead(
  conversationId: string,
  supabaseClient?: any
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const { error } = await supabase
    .from('conversation_messages')
    .update({ delivery_status: 'read' })
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'staff')
    .neq('delivery_status', 'read')
  if (error) throw error
}


export async function updateConversationMessageStatusByTwilioSid(
  twilioSid: string,
  deliveryStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  supabaseClient?: any
): Promise<{ success: boolean; error?: any }> {
  const supabase = supabaseClient || (await createClient())
  const { data, error } = await supabase
    .from('conversation_messages')
    .update({ delivery_status: deliveryStatus })
    .eq('twilio_sid', twilioSid)
    .select(`*, sender:users(*)`)
    .single()
  if (error) return { success: false, error }

  try {
    const conversationId = (data as any)?.conversation_id
    if (conversationId) {
      try {
        await broadcastToConversation(conversationId, data, supabase, 'UPDATE')
      } catch (bErr) {
        return { success: false, error: bErr }
      }
    }
  } catch (bErr) {
    return { success: false, error: bErr }
  }

  return { success: true }
}

/**
 * Send a text message to a WhatsApp number via the WhatsApp Cloud API.
 */
async function sendWhatsAppCloudMessage(
  to: string,
  text: string
): Promise<{ waMessageId: string | null }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return { waMessageId: null }

  // Normalize: remove whatsapp: prefix if present, ensure + prefix
  const normalized = to.replace(/^whatsapp:/i, '').trim()
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`
  // WhatsApp Cloud API wants digits only (no +)
  const digits = withPlus.replace(/^\+/, '')

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
      text: { body: text },
    }),
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    console.error('[whatsapp] Send failed:', resp.status, errData)
    return { waMessageId: null }
  }

  const data = await resp.json() as any
  const waMessageId = data?.messages?.[0]?.id || null
  return { waMessageId }
}

/**
 * Send an image message via WhatsApp Cloud API.
 * If imageUrl is a public URL, send by link. Otherwise upload media first.
 */
async function sendWhatsAppImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ waMessageId: string | null }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return { waMessageId: null }

  const normalized = to.replace(/^whatsapp:/i, '').trim()
  const digits = (normalized.startsWith('+') ? normalized : `+${normalized}`).replace(/^\+/, '')

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
        link: imageUrl,
        ...(caption ? { caption } : {}),
      },
    }),
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    console.error('[whatsapp] Send image failed:', resp.status, errData)
    return { waMessageId: null }
  }

  const data = await resp.json() as any
  return { waMessageId: data?.messages?.[0]?.id || null }
}

/**
 * Send an audio message via WhatsApp Cloud API using a public URL.
 */
async function sendWhatsAppAudioMessage(
  to: string,
  audioUrl: string
): Promise<{ waMessageId: string | null }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return { waMessageId: null }

  const normalized = to.replace(/^whatsapp:/i, '').trim()
  const digits = (normalized.startsWith('+') ? normalized : `+${normalized}`).replace(/^\+/, '')

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
      audio: { link: audioUrl, voice: true },
    }),
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    console.error('[whatsapp] Send audio failed:', resp.status, errData)
    return { waMessageId: null }
  }

  const data = await resp.json() as any
  return { waMessageId: data?.messages?.[0]?.id || null }
}

/**
 * Send a document message via WhatsApp Cloud API.
 */
async function sendWhatsAppDocumentMessage(
  to: string,
  documentUrl: string,
  caption?: string,
  filename?: string
): Promise<{ waMessageId: string | null }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return { waMessageId: null }

  const normalized = to.replace(/^whatsapp:/i, '').trim()
  const digits = (normalized.startsWith('+') ? normalized : `+${normalized}`).replace(/^\+/, '')

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
      type: 'document',
      document: {
        link: documentUrl,
        ...(caption ? { caption } : {}),
        ...(filename ? { filename } : {}),
      },
    }),
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    console.error('[whatsapp] Send document failed:', resp.status, errData)
    return { waMessageId: null }
  }

  const data = await resp.json() as any
  return { waMessageId: data?.messages?.[0]?.id || null }
}

export async function sendMessageWithWhatsApp(
  conversationId: string,
  messageText: string,
  supabaseClient?: any
): Promise<ConversationMessage> {
  const supabase = supabaseClient || (await createClient())
  const conversation = await getConversationById(conversationId, supabase)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  // Create message record first
  const createdMessage = await sendMessage(conversationId, messageText, 'staff', undefined, supabase)

  if (conversation.whatsapp_number) {
    try {
      const { waMessageId } = await sendWhatsAppCloudMessage(conversation.whatsapp_number, messageText)

      if (waMessageId) {
        // Update DB record with WhatsApp message ID
        const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? (await import('@supabase/supabase-js')).createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            )
          : null
        const writeClient: any = adminSupabase || supabase

        const { data: updatedData, error: updateError } = await writeClient
          .from('conversation_messages')
          .update({
            twilio_sid: waMessageId, // reusing column for wa message id
            delivery_status: 'sent',
          })
          .eq('id', createdMessage.id)
          .select(`*, sender:users(*)`)
          .single()

        if (!updateError && updatedData) {
          try {
            await broadcastToConversation(conversationId, updatedData, writeClient, 'UPDATE')
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore — message already saved locally
    }
  }

  return createdMessage
}
