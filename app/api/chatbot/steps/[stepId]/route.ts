import { getChatbotStepById, updateChatbotStep, deleteChatbotStep } from '@/lib/services/chatbot'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    const step = await getChatbotStepById(stepId)
    if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(step)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    const body = await request.json()
    const step = await updateChatbotStep(stepId, body)
    return NextResponse.json(step)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params
    await deleteChatbotStep(stepId)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
