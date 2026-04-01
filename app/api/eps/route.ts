import { getEPS, createEPS } from '@/lib/services/eps'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const eps = await getEPS()
    return NextResponse.json(eps)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const eps = await createEPS(body)
    return NextResponse.json(eps, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
