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
    const channel: any = supabase.channel(topic)
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

export async function sendMessage(
  conversationId: string,
  messageText: string,
  senderType: 'patient' | 'staff',
  senderId?: string,
  supabaseClient?: any,
  mediaUrl?: string | null,
  mediaType?: string | null,
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
 * Helper: get or create a Twilio Conversations client.
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')
  return twilio(accountSid, authToken)
}

/**
 * Given a local conversation, ensure it has a valid conversation_sid.
 * If the conversation_sid is missing or stale (404 from Twilio),
 * look it up by participant phone or create a new Twilio Conversation.
 */
export async function ensureConversationSid(
  conversationId: string,
  whatsappNumber: string,
  supabaseClient?: any
): Promise<string | null> {
  const supabase = supabaseClient || (await createClient())

  // Check if we already have a conversation_sid stored
  const { data: conv } = await supabase
    .from('conversations')
    .select('conversation_sid')
    .eq('id', conversationId)
    .single()

  const client = getTwilioClient()
  if (!client) return null

  const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
  if (!serviceSid) return null

  // If we have a stored SID, validate it against Twilio
  if (conv?.conversation_sid) {
    try {
      const existing = await client.conversations.v1
        .services(serviceSid)
        .conversations(conv.conversation_sid)
        .fetch()
      // If it still exists and is active, use it
      if (existing && existing.state !== 'closed') {
        return conv.conversation_sid
      }
      // Conversation exists but is closed — treat as stale
    } catch {
      // ignore — stale or invalid SID
    }
    // Clear the stale SID from DB
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? (await import('@supabase/supabase-js')).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : null
    await (adminSupabase || supabase)
      .from('conversations')
      .update({ conversation_sid: null })
      .eq('id', conversationId)
  }

  // Normalize the WhatsApp address for participant binding
  const normalizedPhone = whatsappNumber.replace(/^whatsapp:/i, '').trim()
  const withPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`
  const participantAddress = `whatsapp:${withPlus}`

  try {
    // Try to find an existing conversation by listing participants with this address.
    // Twilio auto-creates conversations when the sandbox is in auto-create mode,
    // so there may already be one from the first inbound message.
    const participants = await client.conversations.v1
      .services(serviceSid)
      .participantConversations.list({ address: participantAddress, limit: 5 })

    // Pick the most recent active conversation
    const active = participants.find(
      (p: any) => p.conversationState === 'active'
    )
    if (active) {
      const sid = active.conversationSid
      // Persist to DB
      const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? (await import('@supabase/supabase-js')).createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
        : null
      await (adminSupabase || supabase)
        .from('conversations')
        .update({ conversation_sid: sid })
        .eq('id', conversationId)
      return sid
    }

    // No existing conversation — create one
    const newConv = await client.conversations.v1
      .services(serviceSid)
      .conversations.create({ friendlyName: `wa-${conversationId}` })

    // Add the WhatsApp participant
    await client.conversations.v1
      .services(serviceSid)
      .conversations(newConv.sid)
      .participants.create({
        'messagingBinding.address': participantAddress,
        'messagingBinding.proxyAddress': process.env.TWILIO_WHATSAPP_NUMBER?.startsWith('whatsapp:')
          ? process.env.TWILIO_WHATSAPP_NUMBER
          : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      })

    // Persist to DB
    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? (await import('@supabase/supabase-js')).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : null
    await (adminSupabase || supabase)
      .from('conversations')
      .update({ conversation_sid: newConv.sid })
      .eq('id', conversationId)

    return newConv.sid
  } catch {
    return null
  }
}

/**
 * Ensure that a staff/chat-based user is added as a participant to the Twilio
 * Conversation. This is required for the Read Horizon (advanceLastReadMessageIndex)
 * to work — Twilio needs to know which participant read the messages so it can
 * send blue-check receipts back to WhatsApp.
 *
 * Chat participants are identified by `identity` (not a phone binding).
 */
export async function ensureStaffParticipant(
  conversationSid: string,
  identity: string
): Promise<boolean> {
  const client = getTwilioClient()
  const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
  if (!client || !serviceSid || !conversationSid || !identity) return false

  try {
    // List current participants and check if one already has this identity
    const participants = await client.conversations.v1
      .services(serviceSid)
      .conversations(conversationSid)
      .participants.list({ limit: 50 })

    const existing = participants.find((p: any) => p.identity === identity)
    if (existing) return true

    // Add as a chat participant (no messagingBinding — purely SDK-based)
    await client.conversations.v1
      .services(serviceSid)
      .conversations(conversationSid)
      .participants.create({ identity })

    return true
  } catch (err: any) {
    if (err?.code === 50433) return true
    if (err?.status === 404 || err?.code === 20404) return false
    return false
  }
}

export async function sendMessageWithTwilio(
  conversationId: string,
  messageText: string,
  supabaseClient?: any
): Promise<ConversationMessage> {
  const supabase = supabaseClient || (await createClient())
  const conversation = await getConversationById(conversationId, supabase)
  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`)
  }

  // Create message record first so we can update delivery metadata from Twilio callbacks.
  const createdMessage = await sendMessage(conversationId, messageText, 'staff', undefined, supabase)

  const client = getTwilioClient()
  const serviceSid = process.env.CONVERSATIONS_SERVICE_SID

  if (client && serviceSid) {
    try {
      // Ensure we have a Twilio Conversation SID
      const convSid = await ensureConversationSid(
        conversationId,
        conversation.whatsapp_number,
        supabase
      )

      if (!convSid) {
        return createdMessage
      }

      // Send message via Twilio Conversations API
      // xTwilioWebhookEnabled triggers onDeliveryUpdated webhooks for REST API calls
      const twilioMsg = await client.conversations.v1
        .services(serviceSid)
        .conversations(convSid)
        .messages.create({
          author: 'bot',
          body: messageText,
          xTwilioWebhookEnabled: 'true',
        })

      // Update DB record with Twilio message SID and message index
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
          twilio_sid: twilioMsg.sid,
          message_index: twilioMsg.index ?? null,
          delivery_status: 'sent',
        })
        .eq('id', createdMessage.id)
        .select(`*, sender:users(*)`)
        .single()

      if (!updateError && updatedData) {
        try {
          await broadcastToConversation(conversationId, updatedData, writeClient, 'UPDATE')
        } catch (bErr) {
          // ignore broadcast failures
        }
      }
    } catch {
      // ignore Twilio errors — message already saved locally
    }
  } else {
    // Twilio not configured
  }

  return createdMessage
}
