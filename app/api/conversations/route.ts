import { getConversations, createConversation } from '@/lib/services/conversations'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined
    const conversations = await getConversations(status)
    return NextResponse.json(conversations)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const conversation = await createConversation(body)
    return NextResponse.json(conversation, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
