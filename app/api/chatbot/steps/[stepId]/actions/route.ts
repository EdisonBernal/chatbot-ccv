import { getChatbotActions, createChatbotAction } from '@/lib/services/chatbot'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    const actions = await getChatbotActions(stepId)
    return NextResponse.json(actions)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    const body = await request.json()
    const action = await createChatbotAction(stepId, body)
    return NextResponse.json(action, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
