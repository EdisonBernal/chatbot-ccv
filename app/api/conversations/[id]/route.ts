import { updateConversation, broadcastConversationStatusChange } from '@/lib/services/conversations'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updated = await updateConversation(id, body)

    // Broadcast status change so all UI clients update in realtime
    if (body.status) {
      broadcastConversationStatusChange(id, body.status).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
