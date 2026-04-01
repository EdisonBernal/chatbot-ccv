import { updateAppointmentStatus } from '@/lib/services/appointments'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, notes, old_status, created_by } = await request.json()
    if (!status || !created_by) {
      return NextResponse.json({ error: 'status and created_by required' }, { status: 400 })
    }
    const result = await updateAppointmentStatus(id, { status, notes }, created_by, old_status)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
