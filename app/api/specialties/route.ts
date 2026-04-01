import { getSpecialties, createSpecialty } from '@/lib/services/specialties'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const specialties = await getSpecialties()
    return NextResponse.json(specialties)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const specialty = await createSpecialty(body)
    return NextResponse.json(specialty, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
