import { getAppointments, createAppointment } from '@/lib/services/appointments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined
    const data = await getAppointments(status ? { status } : undefined)
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { created_by, ...formData } = body
    const appt = await createAppointment(formData, created_by)
    return NextResponse.json(appt, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
