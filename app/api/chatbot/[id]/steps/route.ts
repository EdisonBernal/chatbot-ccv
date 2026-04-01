import { getChatbotSteps, createChatbotStep } from '@/lib/services/chatbot'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const steps = await getChatbotSteps(id)
    return NextResponse.json(steps)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    console.log('[api/chatbot/[id]/steps] POST body', body)
    const step = await createChatbotStep(id, body)
    console.log('[api/chatbot/[id]/steps] created step', step)
    return NextResponse.json(step, { status: 201 })
  } catch (e: unknown) {
    console.error('[api/chatbot/[id]/steps] error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
