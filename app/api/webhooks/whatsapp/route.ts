import { sendMessage, broadcastConversationStatusChange, broadcastNewConversation } from '@/lib/services/conversations'
import { getChatbotConfigs, clearChatbotSession } from '@/lib/services/chatbot'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ChatbotEngine } from '@/lib/chatbot-engine'
import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'

/**
 * WhatsApp Cloud API Webhook
 * 
 * GET  — Verificación del webhook (Meta envía hub.verify_token + hub.challenge)
 * POST — Mensajes entrantes + actualizaciones de estado de entrega
 *
 * Variables de entorno necesarias:
 * - WHATSAPP_PHONE_NUMBER_ID
 * - WHATSAPP_ACCESS_TOKEN
 * - WHATSAPP_VERIFY_TOKEN
 * - WHATSAPP_APP_SECRET (para verificar firma)
 */

// ── Verificar firma de Meta (X-Hub-Signature-256) ──
function verifyMetaSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) return false
  
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))
  } catch {
    return false
  }
}

// ── Helpers ──
function classifyMediaType(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType?.startsWith('audio/')) return 'audio'
  if (mimeType?.startsWith('video/')) return 'video'
  return 'document'
}

function getExtFromMime(mime: string): string {
  if (mime?.includes('ogg')) return 'ogg'
  if (mime?.includes('mp4')) return 'mp4'
  if (mime?.includes('mpeg')) return 'mp3'
  if (mime?.includes('webm')) return 'webm'
  if (mime?.includes('amr')) return 'amr'
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg'
  if (mime?.includes('webp')) return 'webp'
  if (mime?.includes('pdf')) return 'pdf'
  return 'bin'
}

// ── Download media from WhatsApp Cloud API and upload to Supabase Storage ──
async function downloadAndUploadMedia(
  mediaId: string,
  mimeType: string,
  conversationId: string,
  writeClient: any
): Promise<{ url: string | null; type: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!accessToken) return { url: null, type: classifyMediaType(mimeType) }

  try {
    // 1. Get the media URL from WhatsApp
    const metaResp = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!metaResp.ok) {
      console.error(`[wa-webhook] Media metadata failed: ${metaResp.status}`)
      return { url: null, type: classifyMediaType(mimeType) }
    }
    const metaData = await metaResp.json() as any
    const mediaUrl = metaData.url

    // 2. Download the actual media from the URL
    const mediaResp = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!mediaResp.ok) {
      console.error(`[wa-webhook] Media download failed: ${mediaResp.status}`)
      return { url: null, type: classifyMediaType(mimeType) }
    }

    const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer())
    const ext = getExtFromMime(mimeType)
    const safeName = `${conversationId}/${Date.now()}.${ext}`

    // 3. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await writeClient.storage
      .from('chat-media')
      .upload(safeName, mediaBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      })

    if (!uploadError && uploadData?.path) {
      const { data: urlData } = writeClient.storage
        .from('chat-media')
        .getPublicUrl(uploadData.path)
      return { url: urlData?.publicUrl || null, type: classifyMediaType(mimeType) }
    } else if (uploadError) {
      console.error(`[wa-webhook] Upload error:`, uploadError)
    }
  } catch (err) {
    console.error(`[wa-webhook] downloadAndUploadMedia error:`, err)
  }

  return { url: null, type: classifyMediaType(mimeType) }
}

// ═══════════════════════════════════════════════════════════════
// GET — Webhook Verification
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[wa-webhook] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[wa-webhook] Verification failed')
  return new NextResponse('Forbidden', { status: 403 })
}

// ═══════════════════════════════════════════════════════════════
// POST — Incoming messages & status updates
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer())
    
    // Verify signature
    const signature = request.headers.get('x-hub-signature-256') || ''
    if (process.env.WHATSAPP_APP_SECRET && !verifyMetaSignature(rawBody, signature)) {
      console.warn('[wa-webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const body = JSON.parse(rawBody.toString('utf-8'))

    // Meta always sends { object: 'whatsapp_business_account', entry: [...] }
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const writeClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null

    if (!writeClient) {
      console.error('[wa-webhook] No SUPABASE_SERVICE_ROLE_KEY configured')
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue
        const value = change.value

        // ── Status updates (sent, delivered, read, failed) ────────────
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const waMessageId = status.id // wamid.xxx
            const statusName = status.status // sent, delivered, read, failed

            const mappedStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' =
              statusName === 'read' ? 'read'
              : statusName === 'delivered' ? 'delivered'
              : statusName === 'failed' ? 'failed'
              : statusName === 'sent' ? 'sent'
              : 'queued'

            console.log(`[wa-webhook] Status update: ${waMessageId} → ${mappedStatus}`)

            if (waMessageId) {
              // Helper: try to update and broadcast
              const tryStatusUpdate = async (): Promise<boolean> => {
                const { data, error } = await writeClient
                  .from('conversation_messages')
                  .update({ delivery_status: mappedStatus })
                  .eq('twilio_sid', waMessageId)
                  .select('*, sender:users(*)')
                  .maybeSingle()

                if (error) {
                  console.error(`[wa-webhook] Status update DB error for ${waMessageId}:`, error)
                  return false
                }
                if (data) {
                  console.log(`[wa-webhook] Status updated in DB: msg=${data.id}, conv=${data.conversation_id}, status=${mappedStatus}`)
                  const { broadcastToConversation } = await import('@/lib/services/conversations')
                  await broadcastToConversation(data.conversation_id, data, writeClient, 'UPDATE').catch(() => {})
                  return true
                }
                return false // no match
              }

              try {
                const found = await tryStatusUpdate()
                if (!found) {
                  // Race condition: status webhook arrived before reply route saved twilio_sid.
                  // Schedule a retry via after() so it runs after the response is sent.
                  console.log(`[wa-webhook] No message for ${waMessageId}, scheduling retry...`)
                  after(async () => {
                    // Small delay to allow the reply route to save twilio_sid
                    await new Promise(r => setTimeout(r, 2500))
                    try {
                      const retryFound = await tryStatusUpdate()
                      if (!retryFound) {
                        console.warn(`[wa-webhook] Retry: still no message for ${waMessageId} → ${mappedStatus}`)
                      }
                    } catch (err) {
                      console.error(`[wa-webhook] Retry error for ${waMessageId}:`, err)
                    }
                  })
                }
              } catch (err) {
                console.error(`[wa-webhook] Status update error for ${waMessageId}:`, err)
              }
            }
          }
        }

        // ── Incoming messages ─────────────────────────────────────────
        if (value.messages && Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const senderPhone = msg.from // e.g. '573001234567' (no +)
            const waMessageId = msg.id   // wamid.xxx
            const msgType = msg.type     // text, image, audio, video, document, sticker, etc.
            const timestamp = msg.timestamp

            // Normalize phone
            const withPlus = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`
            const noPlus = withPlus.replace(/^\+/, '')
            const digitsOnly = noPlus.replace(/\D/g, '')

            // Check for duplicate (by wamid)
            const { data: existingMsg } = await writeClient
              .from('conversation_messages')
              .select('id')
              .eq('twilio_sid', waMessageId)
              .maybeSingle()
            if (existingMsg) continue

            // ── Find or create conversation ──
            let conv: any = null
            let isNewConversation = false

            // Look up by phone
            const convFilter = `whatsapp_number.eq.${withPlus},whatsapp_number.eq.${noPlus},whatsapp_number.eq.${digitsOnly}`
            const { data: convByPhone } = await writeClient
              .from('conversations')
              .select('id, patient_id, status')
              .or(convFilter)
              .maybeSingle()
            conv = convByPhone

            if (!conv) {
              // Find or create patient
              const patientFilter = `phone_number.eq.${withPlus},phone_number.eq.${noPlus},phone_number.eq.${digitsOnly}`
              const { data: patient } = await writeClient
                .from('patients')
                .select('id')
                .or(patientFilter)
                .maybeSingle()

              let patientId = patient?.id || null

              if (!patientId) {
                // Use contact name from webhook if available
                const contactName = value.contacts?.[0]?.profile?.name || 'WhatsApp user'
                const { data: newPatient, error: patientInsertError } = await writeClient
                  .from('patients')
                  .insert({
                    document_number: `wa-${Date.now()}`,
                    full_name: contactName,
                    phone_number: withPlus,
                  })
                  .select('id')
                  .maybeSingle()
                if (patientInsertError) throw patientInsertError
                patientId = newPatient?.id || null
              }

              const { data: newConv, error: insertError } = await writeClient
                .from('conversations')
                .insert({
                  whatsapp_number: withPlus,
                  patient_id: patientId,
                  status: 'nueva',
                })
                .select('id, patient_id, status')
                .maybeSingle()

              if (insertError) {
                // Race condition — retry lookup
                const { data: retryConv } = await writeClient
                  .from('conversations')
                  .select('id, patient_id, status')
                  .or(convFilter)
                  .maybeSingle()
                conv = retryConv
              } else {
                conv = newConv
                isNewConversation = true
              }
            }

            if (!conv) continue

            // ── Extract message content ──
            let textBody = ''
            let incomingMediaUrl: string | null = null
            let incomingMediaType: string | null = null

            if (msgType === 'text') {
              textBody = msg.text?.body || ''
            } else if (['image', 'audio', 'video', 'document', 'sticker'].includes(msgType)) {
              const mediaObj = msg[msgType]
              if (mediaObj?.id) {
                const mimeType = mediaObj.mime_type || ''
                const result = await downloadAndUploadMedia(mediaObj.id, mimeType, conv.id, writeClient)
                incomingMediaUrl = result.url
                incomingMediaType = result.type
              }
              // Caption for images/videos/documents
              textBody = mediaObj?.caption || ''
            } else if (msgType === 'reaction') {
              // Ignore reactions for now
              continue
            } else if (msgType === 'location') {
              textBody = `📍 Ubicación: ${msg.location?.latitude}, ${msg.location?.longitude}`
            } else if (msgType === 'contacts') {
              textBody = `👤 Contacto compartido`
            }

            // Determine display text
            const hasMedia = !!incomingMediaUrl
            const defaultLabel = incomingMediaType === 'audio' ? '🎤 Audio'
              : incomingMediaType === 'image' ? '📷 Imagen'
              : incomingMediaType === 'video' ? '🎬 Video'
              : hasMedia ? '📎 Archivo' : ''
            const messageText = textBody || (hasMedia ? defaultLabel : '')

            if (!messageText && !hasMedia) continue

            // ── Resolve reply context (when patient replies to a specific message) ──
            let replyToMessageId: string | null = null
            if (msg.context?.id) {
              // msg.context.id is the wamid of the message being replied to
              const { data: repliedMsg } = await writeClient
                .from('conversation_messages')
                .select('id')
                .eq('twilio_sid', msg.context.id)
                .maybeSingle()
              if (repliedMsg) {
                replyToMessageId = repliedMsg.id
              } else {
                console.log(`[wa-webhook] Reply context: no message found for wamid=${msg.context.id}`)
              }
            }

            // Save message
            const createdMsg = await sendMessage(conv.id, messageText, 'patient', undefined, writeClient, incomingMediaUrl, incomingMediaType, replyToMessageId)

            // Store the WhatsApp message ID for status tracking
            if (waMessageId && createdMsg?.id) {
              await writeClient
                .from('conversation_messages')
                .update({ twilio_sid: waMessageId, delivery_status: 'delivered' })
                .eq('id', createdMsg.id)
            }

            // Broadcast new conversation AFTER the first message exists
            // so the frontend fetch returns complete data
            if (isNewConversation && conv?.id) {
              try { await broadcastNewConversation(conv.id, writeClient) } catch { /* ignore */ }
            }

            // ── Update conversation status ──
            const originalStatus = conv.status
            const newStatus = originalStatus === 'cerrada' ? 'nueva' : originalStatus

            if (originalStatus === 'cerrada') {
              try {
                await clearChatbotSession(conv.id, writeClient)
              } catch { /* ignore */ }
              conv.status = 'nueva'
            }

            await writeClient
              .from('conversations')
              .update({
                last_message: messageText || textBody,
                last_message_at: new Date().toISOString(),
                status: newStatus,
              })
              .eq('id', conv.id)

            if (originalStatus === 'cerrada') {
              try {
                await broadcastConversationStatusChange(conv.id, 'nueva', writeClient)
              } catch { /* ignore */ }
            }

            // ── Run chatbot (only if not en_atencion) ──
            if (conv.status !== 'en_atencion') {
              try {
                const configs = await getChatbotConfigs(writeClient)
                const activeConfig = configs.find((cfg: any) => cfg.is_active)
                if (activeConfig) {
                  const engine = new ChatbotEngine(conv.id, writeClient)
                  await engine.processMessage(textBody, activeConfig)
                }
              } catch {
                // chatbot error — dont block webhook
              }
            }
          }
        }
      }
    }

    // Meta requires 200 within 20 seconds
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[wa-webhook] Error:', err)
    // Always return 200 to Meta to avoid retries
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}
