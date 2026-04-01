import { NextRequest, NextResponse } from 'next/server'
import { broadcastToConversation } from '@/lib/services/conversations'

// Dev-only: trigger an UPDATE broadcast for a specific conversation message
export async function POST(request: NextRequest, { params }: { params: { convId: string; msgId: string } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  try {
    const { convId, msgId } = params

    const payload = {
      id: msgId,
      conversation_id: convId,
      delivery_status: 'delivered',
      updated_at: new Date().toISOString(),
    }

    const res = await broadcastToConversation(convId, payload)
    return NextResponse.json({ success: true, res })
  } catch (e: unknown) {
    console.error('[debug] broadcast-update exception', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
