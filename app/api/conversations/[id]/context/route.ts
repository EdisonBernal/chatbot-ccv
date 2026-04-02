import { getChatbotContext, clearChatbotSession } from '@/lib/services/chatbot'
import { NextRequest, NextResponse } from 'next/server'

/** Internal context keys that should not be exposed to the UI */
const INTERNAL_KEYS = new Set([
  'chatbot_current_step_id',
  'chatbot_retry_count',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await getChatbotContext(id)

    // Filter out only internal session keys; keep everything else
    // (collect_info fields AND response_* user selections)
    const filtered: Record<string, string> = {}
    for (const [key, value] of Object.entries(context)) {
      if (!INTERNAL_KEYS.has(key) && value) {
        filtered[key] = value
      }
    }

    return NextResponse.json(filtered)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await clearChatbotSession(id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
