import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Actualizar last_view_at a la hora actual
    const { error } = await supabase
      .from('conversations')
      .update({ last_view_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      // If the column doesn't exist in the DB schema (e.g. migrations not run),
      // avoid returning 500 to the client — log and return success so UI doesn't break.
      if (error.code === 'PGRST204' && (error.message || '').includes('last_view_at')) {
        console.warn('[v0] conversations.last_view_at column missing; skipping update')
        return NextResponse.json({ success: true })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('[v0] Error in view route:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
