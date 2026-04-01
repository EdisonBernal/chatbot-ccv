import { createClient } from '@/lib/supabase/server'
import type { Patient, PatientFormData } from '@/lib/types'

export async function getPatients(search?: string): Promise<Patient[]> {
  const supabase = await createClient()
  let query = supabase
    .from('patients')
    .select('*, eps:eps(*)')
    .order('full_name', { ascending: true })

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,document_number.ilike.%${search}%,phone_number.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data as Patient[]) || []
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .select('*, eps:eps(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Patient
}

export async function createPatient(formData: PatientFormData): Promise<Patient> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .insert(formData)
    .select('*, eps:eps(*)')
    .single()
  if (error) throw error
  return data as Patient
}

export async function updatePatient(
  id: string,
  formData: Partial<PatientFormData>
): Promise<Patient> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .update(formData)
    .eq('id', id)
    .select('*, eps:eps(*)')
    .single()
  if (error) throw error
  return data as Patient
}

export async function deletePatient(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
}
