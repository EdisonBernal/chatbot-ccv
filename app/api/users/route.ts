import { getUsers } from '@/lib/services/users'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const users = await getUsers()
    return NextResponse.json(users)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
