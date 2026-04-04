import { getConversationById, ensureConversationSid } from '@/lib/services/conversations'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/debug/read-horizon?conversationId=<uuid>
 *
 * Diagnostic endpoint: shows the current state of participants, messages,
 * and read horizons in a Twilio Conversation. Useful for debugging why
 * blue checks aren't appearing on WhatsApp.
 */
export async function GET(request: NextRequest) {
  try {
    const conversationId = request.nextUrl.searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId query param required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const serviceSid = process.env.CONVERSATIONS_SERVICE_SID
    if (!accountSid || !authToken || !serviceSid) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    }

    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null
    const writeClient: any = adminSupabase || supabase

    const conversation = await getConversationById(conversationId, writeClient)
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const convSid = conversation.whatsapp_number
      ? await ensureConversationSid(conversationId, conversation.whatsapp_number, writeClient)
      : conversation.conversation_sid

    if (!convSid) return NextResponse.json({ error: 'No Twilio conversation SID' }, { status: 404 })

    const twilio = require('twilio')
    const client = twilio(accountSid, authToken)

    // Fetch conversation details
    const twilioConv = await client.conversations.v1
      .services(serviceSid)
      .conversations(convSid)
      .fetch()

    // Fetch participants
    const participants = await client.conversations.v1
      .services(serviceSid)
      .conversations(convSid)
      .participants.list({ limit: 50 })

    // Fetch last 5 messages
    const messages = await client.conversations.v1
      .services(serviceSid)
      .conversations(convSid)
      .messages.list({ limit: 5, order: 'desc' })

    return NextResponse.json({
      conversation: {
        sid: twilioConv.sid,
        state: twilioConv.state,
        friendlyName: twilioConv.friendlyName,
      },
      currentUserIdentity: user.id,
      participants: participants.map((p: any) => ({
        sid: p.sid,
        identity: p.identity || null,
        type: p.identity ? 'chat' : 'whatsapp',
        messagingBinding: p.messagingBinding || null,
        lastReadMessageIndex: p.lastReadMessageIndex,
        lastReadTimestamp: p.lastReadTimestamp,
        identityMatchesToken: p.identity === user.id,
      })),
      recentMessages: messages.map((m: any) => ({
        sid: m.sid,
        index: m.index,
        author: m.author,
        body: m.body?.substring(0, 80),
        dateCreated: m.dateCreated,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}
