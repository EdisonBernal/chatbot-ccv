import { updateChatbotAction, deleteChatbotAction } from '@/lib/services/chatbot'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params
    const body = await request.json()
    const action = await updateChatbotAction(actionId, body)
    return NextResponse.json(action)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params
    await deleteChatbotAction(actionId)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
