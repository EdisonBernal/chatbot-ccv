import { createClient } from '@/lib/supabase/server'
import type { EPS, EPSFormData } from '@/lib/types'

export async function getEPS(onlyActive = false): Promise<EPS[]> {
  const supabase = await createClient()
  let query = supabase.from('eps').select('*').order('name')
  if (onlyActive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data as EPS[]) || []
}

export async function getEPSById(id: string): Promise<EPS | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('eps').select('*').eq('id', id).single()
  if (error) return null
  return data as EPS
}

export async function createEPS(formData: EPSFormData): Promise<EPS> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('eps').insert(formData).select('*').single()
  if (error) throw error
  return data as EPS
}

export async function updateEPS(id: string, formData: Partial<EPSFormData>): Promise<EPS> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('eps')
    .update(formData)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as EPS
}

export async function deleteEPS(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('eps').delete().eq('id', id)
  if (error) throw error
}
