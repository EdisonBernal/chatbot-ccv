'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Client as ConversationsClient, Conversation } from '@twilio/conversations'

interface UseTwilioConversationsOptions {
  /** The local DB conversation UUID — the backend resolves the actual Twilio SID */
  conversationId: string | null
  /** Whether the hook should be active (e.g. only when the chat panel is open) */
  enabled?: boolean
  /** Called when a delivery status update is received from the SDK */
  onMessageUpdated?: (messageSid: string, status: string) => void
}

interface UseTwilioConversationsResult {
  /** Whether the SDK client is connected and conversation is joined */
  isConnected: boolean
  /** Any connection error */
  error: string | null
  /** Advance the Read Horizon to mark ALL messages as read (triggers blue checks on WhatsApp) */
  advanceReadHorizon: () => Promise<void>
}

/**
 * Helper: mark all messages as read in a Twilio Conversation using multiple
 * SDK methods to maximise the chance the read report reaches Twilio's backend
 * and is relayed to WhatsApp (blue checks).
 *
 * The SDK batches read reports every ~10 s, so a single call may not transmit
 * immediately.  We call both `setAllMessagesRead()` AND `advanceLastReadMessageIndex()`
 * with the explicit last index.
 *
 * CRITICAL: We verify the client's WebSocket connectionState === 'connected'
 * before calling.  If it's not connected the SDK will silently buffer the call
 * and it may never actually transmit to Twilio.
 */
async function markAllRead(conv: Conversation, label: string, client?: ConversationsClient | null): Promise<void> {
  // Guard: verify the SDK WebSocket is truly connected before attempting
  if (client && client.connectionState !== 'connected') {
    console.warn(`[useTwilioConversations] markAllRead [${label}] skipped — connectionState=${client.connectionState}`)
    return
  }

  try {
    // 1) setAllMessagesRead — preferred, handles index internally
    const unread = await conv.setAllMessagesRead()
    console.log(`[useTwilioConversations] setAllMessagesRead() [${label}] unread=`, unread)
  } catch (e) {
    console.warn(`[useTwilioConversations] setAllMessagesRead error [${label}]:`, e)
  }

  try {
    // 2) Also call advanceLastReadMessageIndex with the explicit last index.
    //    This is a belt-and-suspenders approach — if one method gets batched
    //    away, the other may still transmit.
    const paginator = await conv.getMessages(1)
    const lastMsg = paginator.items[0]
    if (lastMsg && typeof lastMsg.index === 'number') {
      await conv.advanceLastReadMessageIndex(lastMsg.index)
      console.log(`[useTwilioConversations] advanceLastReadMessageIndex(${lastMsg.index}) [${label}]`)
    }
  } catch (e) {
    console.warn(`[useTwilioConversations] advanceLastReadMessageIndex error [${label}]:`, e)
  }
}

export function useTwilioConversations({
  conversationId,
  enabled = true,
  onMessageUpdated,
}: UseTwilioConversationsOptions): UseTwilioConversationsResult {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<ConversationsClient | null>(null)
  const conversationRef = useRef<Conversation | null>(null)
  const onMessageUpdatedRef = useRef(onMessageUpdated)
  onMessageUpdatedRef.current = onMessageUpdated
  // Flag: if advanceReadHorizon() is called before the SDK is connected,
  // we store this intent so the init code can fulfil it once connected.
  const pendingReadRef = useRef(false)
  // Delayed-retry timer for setAllMessagesRead — cleared on cleanup
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId

  // Fetch token from our backend, passing the DB conversationId
  // so the backend resolves the correct Twilio SID and adds the user as participant.
  // Returns { token, conversationSid } where conversationSid is the resolved Twilio SID.
  const fetchToken = useCallback(async (): Promise<{ token: string; conversationSid: string | null } | null> => {
    try {
      const body: any = {}
      if (conversationIdRef.current) {
        body.conversationId = conversationIdRef.current
      }
      const res = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Token fetch failed' }))
        throw new Error(err.error || 'Token fetch failed')
      }
      const data = await res.json()
      return { token: data.token, conversationSid: data.conversationSid || null }
    } catch (err) {
      console.error('[useTwilioConversations] Token fetch error:', err)
      setError(err instanceof Error ? err.message : 'Token fetch failed')
      return null
    }
  }, [])

  // Helper: fetch just the token string (for token refresh — no need to re-resolve SID)
  const refreshToken = useCallback(async (): Promise<string | null> => {
    const result = await fetchToken()
    return result?.token ?? null
  }, [fetchToken])

  // Initialize client and join conversation
  useEffect(() => {
    if (!enabled || !conversationId) return

    let cancelled = false
    let client: ConversationsClient | null = null

    async function init() {
      const result = await fetchToken()
      if (cancelled || !result?.token) return

      const { token, conversationSid: resolvedSid } = result

      if (!resolvedSid) {
        console.warn('[useTwilioConversations] Backend returned no conversationSid — no Twilio conversation exists yet')
        // Not an error — the conversation will be created on next inbound/outbound message
        return
      }

      try {
        client = new ConversationsClient(token)
        clientRef.current = client

        // Token refresh handlers
        client.on('tokenAboutToExpire', async () => {
          const newToken = await refreshToken()
          if (newToken && clientRef.current) {
            await clientRef.current.updateToken(newToken)
          }
        })

        client.on('tokenExpired', async () => {
          const newToken = await refreshToken()
          if (newToken && clientRef.current) {
            await clientRef.current.updateToken(newToken)
          }
        })

        // Wait for the client to initialize
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Client init timeout')), 15000)
          client!.on('stateChanged', (state) => {
            if (state === 'initialized') {
              clearTimeout(timeout)
              resolve()
            } else if (state === 'failed') {
              clearTimeout(timeout)
              reject(new Error('Client initialization failed'))
            }
          })
        })

        if (cancelled) return

        // Get the conversation object using the SID resolved by the backend
        let conv: Conversation
        try {
          conv = await client.getConversationBySid(resolvedSid)
        } catch (convErr: any) {
          const is404 = convErr?.status === 404 || convErr?.message?.includes('Not Found')
          console.warn('[useTwilioConversations] Could not get conversation:', is404 ? '(404 — stale SID)' : convErr)
          setError(is404 ? 'Conversation expired' : 'Could not join conversation')
          return
        }

        if (cancelled) return
        conversationRef.current = conv
        setIsConnected(true)
        setError(null)

        console.log('[useTwilioConversations] Conversation status:', conv.status,
          '| connectionState:', client!.connectionState)

        // ── Diagnostic listeners ─────────────────────────────────────────
        client!.on('connectionStateChanged', (state: string) => {
          console.log('[useTwilioConversations] connectionStateChanged →', state)
          // If the WebSocket reconnects and there was a pending read, fulfil it now
          if (state === 'connected' && pendingReadRef.current && conversationRef.current) {
            pendingReadRef.current = false
            markAllRead(conversationRef.current, 'reconnect', clientRef.current).catch(() => {})
          }
        })

        conv.on('participantUpdated', ({ participant, updateReasons }: any) => {
          if (updateReasons.includes('lastReadMessageIndex')) {
            console.log('[useTwilioConversations] participantUpdated:',
              participant.identity,
              '| lastReadMessageIndex:', participant.lastReadMessageIndex)
          }
        })

        // ── Mark all messages as read (init + belt-and-suspenders) ───────
        // If the SDK WebSocket is connected, send immediately.
        // Otherwise mark as pending — the connectionStateChanged handler will retry.
        if (client!.connectionState === 'connected') {
          pendingReadRef.current = false
          await markAllRead(conv, 'init', client)
        } else {
          console.warn('[useTwilioConversations] SDK initialized but connectionState=',
            client!.connectionState, '— deferring markAllRead')
          pendingReadRef.current = true
        }

        // Schedule a follow-up after 12 s — the SDK batches read reports
        // every ~10 s, so this guarantees at least one full batch cycle
        // with the read report in-flight.
        retryTimerRef.current = setTimeout(async () => {
          if (!cancelled && conversationRef.current && clientRef.current) {
            await markAllRead(conversationRef.current, 'delayed-retry', clientRef.current)
          }
        }, 12_000)

        // ── Conversation event listeners ─────────────────────────────────
        // New incoming message → mark all as read immediately
        conv.on('messageAdded', async () => {
          if (clientRef.current) {
            await markAllRead(conv, 'messageAdded', clientRef.current)
          }
        })

        // Delivery updates → propagate to UI
        conv.on('messageUpdated', ({ message, updateReasons }: any) => {
          if (
            updateReasons.includes('deliveryReceipt') &&
            message.sid &&
            onMessageUpdatedRef.current
          ) {
            const receipt = message.aggregatedDeliveryReceipt
            let status = 'sent'
            if (receipt) {
              if (receipt.read !== 'none') status = 'read'
              else if (receipt.delivered !== 'none') status = 'delivered'
              else if (receipt.sent !== 'none') status = 'sent'
              else if (receipt.failed !== 'none') status = 'failed'
              else if (receipt.undelivered !== 'none') status = 'undelivered'
            }
            onMessageUpdatedRef.current(message.sid, status)
          }
        })

      } catch (err) {
        if (!cancelled) {
          console.error('[useTwilioConversations] Init error:', err)
          setError(err instanceof Error ? err.message : 'Init failed')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      conversationRef.current = null
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (clientRef.current) {
        clientRef.current.shutdown()
        clientRef.current = null
      }
      setIsConnected(false)
    }
  }, [conversationId, enabled, fetchToken, refreshToken])

  // Manual advance Read Horizon (e.g. when user opens conversation or scrolls to bottom)
  // If the SDK is not connected yet, sets a pending flag so init will call it.
  const advanceReadHorizon = useCallback(async () => {
    const conv = conversationRef.current
    if (!conv) {
      pendingReadRef.current = true
      console.log('[useTwilioConversations] advanceReadHorizon: no conversation ref, queued as pending')
      return
    }
    const cl = clientRef.current
    if (!cl || cl.connectionState !== 'connected') {
      pendingReadRef.current = true
      console.log('[useTwilioConversations] advanceReadHorizon: SDK not connected (state=',
        cl?.connectionState, '), queued as pending')
      return
    }
    await markAllRead(conv, 'manual', cl)
  }, [])

  return { isConnected, error, advanceReadHorizon }
}
