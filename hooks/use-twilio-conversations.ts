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
 * React hook that initializes the Twilio Conversations client-side SDK.
 * - Sends the DB `conversationId` to /api/twilio/token which resolves
 *   a valid Twilio SID (handling stale/missing SIDs automatically).
 * - Connects to the Conversations service using the resolved SID.
 * - On init + on every new `messageAdded` event, calls
 *   `conversation.advanceLastReadMessageIndex(message.index)`
 *   to advance the Read Horizon → triggers blue check marks on WhatsApp.
 * - Listens for `updated` events on messages to propagate delivery status changes.
 */
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

        // Advance Read Horizon to the last message index on open
        try {
          const paginator = await conv.getMessages(1)
          const lastMsg = paginator.items[0]
          if (lastMsg && typeof lastMsg.index === 'number') {
            await conv.advanceLastReadMessageIndex(lastMsg.index)
            console.log('[useTwilioConversations] Read Horizon advanced on open to index', lastMsg.index)
          }
        } catch (readErr) {
          console.warn('[useTwilioConversations] advanceLastReadMessageIndex error on init:', readErr)
        }

        // Listen for new incoming messages → advance Read Horizon to the new message index
        conv.on('messageAdded', async (message) => {
          if (typeof message.index === 'number') {
            try {
              await conv.advanceLastReadMessageIndex(message.index)
            } catch (readErr) {
              console.warn('[useTwilioConversations] advanceLastReadMessageIndex error on messageAdded:', readErr)
            }
          }
        })

        // Listen for message delivery updates → propagate to UI
        conv.on('messageUpdated', ({ message, updateReasons }) => {
          if (
            updateReasons.includes('deliveryReceipt') &&
            message.sid &&
            onMessageUpdatedRef.current
          ) {
            // Derive aggregate status from the receipt fields (each is "none" | "some" | "all")
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
      if (clientRef.current) {
        clientRef.current.shutdown()
        clientRef.current = null
      }
      setIsConnected(false)
    }
  }, [conversationId, enabled, fetchToken, refreshToken])

  // Manual advance Read Horizon (e.g. when user opens conversation or scrolls to bottom)
  const advanceReadHorizon = useCallback(async () => {
    const conv = conversationRef.current
    if (!conv) return

    try {
      const paginator = await conv.getMessages(1)
      const lastMsg = paginator.items[0]
      if (lastMsg && typeof lastMsg.index === 'number') {
        await conv.advanceLastReadMessageIndex(lastMsg.index)
      }
    } catch (err) {
      console.warn('[useTwilioConversations] advanceReadHorizon error:', err)
    }
  }, [])

  return { isConnected, error, advanceReadHorizon }
}
