import { createClient } from '@/lib/supabase/server'
import type { Specialty, SpecialtyFormData } from '@/lib/types'

export async function getSpecialties(onlyActive = false): Promise<Specialty[]> {
  const supabase = await createClient()
  let query = supabase.from('specialties').select('*').order('name')
  if (onlyActive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data as Specialty[]) || []
}

export async function getSpecialtyById(id: string): Promise<Specialty | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('specialties').select('*').eq('id', id).single()
  if (error) return null
  return data as Specialty
}

export async function createSpecialty(formData: SpecialtyFormData): Promise<Specialty> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('specialties')
    .insert(formData)
    .select('*')
    .single()
  if (error) throw error
  return data as Specialty
}

export async function updateSpecialty(
  id: string,
  formData: Partial<SpecialtyFormData>
): Promise<Specialty> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('specialties')
    .update(formData)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Specialty
}

export async function deleteSpecialty(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('specialties').delete().eq('id', id)
  if (error) throw error
}
