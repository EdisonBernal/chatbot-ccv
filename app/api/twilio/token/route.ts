import { createClient } from '@/lib/supabase/server'
import { ensureStaffParticipant, ensureConversationSid, getConversationById } from '@/lib/services/conversations'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/twilio/token
 * Generates a Twilio Access Token with a ChatGrant for the authenticated user.
 *
 * Accepts optional `conversationId` (DB UUID) in the request body.
 * When provided, the endpoint:
 *   1. Resolves a valid Twilio conversation_sid (auto-creates if stale/missing)
 *   2. Adds the user as a chat participant
 *   3. Returns the resolved `conversationSid` so the frontend SDK can connect to it
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const apiKey = process.env.TWILIO_API_KEY
    const apiSecret = process.env.TWILIO_API_SECRET
    const serviceSid = process.env.CONVERSATIONS_SERVICE_SID

    if (!accountSid || !apiKey || !apiSecret || !serviceSid) {
      return NextResponse.json(
        { error: 'Twilio Conversations not configured' },
        { status: 500 }
      )
    }

    const twilio = require('twilio')
    const { AccessToken } = twilio.jwt
    const { ChatGrant } = AccessToken

    // Identity is the Supabase auth user ID
    const identity = user.id

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity,
      ttl: 3600, // 1 hour
    })

    // Grant access to the Conversations service
    const chatGrant = new ChatGrant({
      serviceSid,
    })
    token.addGrant(chatGrant)

    // Resolve the conversation SID and add the user as participant
    let resolvedConversationSid: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      const conversationId: string | undefined = body?.conversationId

      if (conversationId) {
        // Build an admin write client
        const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? (await import('@supabase/supabase-js')).createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            )
          : null
        const writeClient: any = adminSupabase || supabase

        // Look up the conversation from DB
        const conversation = await getConversationById(conversationId, writeClient)
        if (conversation?.whatsapp_number) {
          // Validate / create a Twilio conversation (handles stale SIDs)
          resolvedConversationSid = await ensureConversationSid(
            conversationId,
            conversation.whatsapp_number,
            writeClient
          )

          // Add the staff user as a chat participant
          if (resolvedConversationSid) {
            const ok = await ensureStaffParticipant(resolvedConversationSid, identity)
            if (!ok) {
              console.warn('[twilio-token] ensureStaffParticipant failed for', resolvedConversationSid)
            }
          }
        }
      }
    } catch {
      // ignore — conversationId is optional
    }

    console.log('[twilio-token] Token generated for identity:', identity, 'conversationSid:', resolvedConversationSid)

    return NextResponse.json({
      token: token.toJwt(),
      identity,
      conversationSid: resolvedConversationSid,
    })
  } catch (error) {
    console.error('[twilio-token] Error generating token:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
