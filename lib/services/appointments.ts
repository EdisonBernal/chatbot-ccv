import { createClient } from '@/lib/supabase/server'
import type {
  AppointmentRequest,
  AppointmentFormData,
  AppointmentStatusUpdate,
  AppointmentRequestHistory,
} from '@/lib/types'

const SELECT_QUERY = `*, patient:patients(*, eps:eps(*)), specialty:specialties(*), creator:users(*)`

export async function getAppointments(filters?: {
  status?: string
  patient_id?: string
}): Promise<AppointmentRequest[]> {
  const supabase = await createClient()
  let query = supabase
    .from('appointment_requests')
    .select(SELECT_QUERY)
    .order('created_at', { ascending: false })
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.patient_id) query = query.eq('patient_id', filters.patient_id)
  const { data, error } = await query
  if (error) throw error
  return (data as AppointmentRequest[]) || []
}

export async function getAppointmentById(id: string): Promise<AppointmentRequest | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_requests')
    .select(SELECT_QUERY)
    .eq('id', id)
    .single()
  if (error) return null
  return data as AppointmentRequest
}

export async function createAppointment(
  formData: AppointmentFormData,
  userId: string
): Promise<AppointmentRequest> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_requests')
    .insert({ ...formData, created_by: userId, status: 'pendiente' })
    .select(SELECT_QUERY)
    .single()
  if (error) throw error
  await supabase.from('appointment_request_history').insert({
    appointment_request_id: data.id,
    action: 'Solicitud creada',
    new_status: 'pendiente',
    notes: 'Solicitud creada',
    created_by: userId,
  })
  return data as AppointmentRequest
}

export async function updateAppointmentStatus(
  id: string,
  update: AppointmentStatusUpdate,
  userId: string,
  oldStatus: string
): Promise<AppointmentRequest> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_requests')
    .update({ status: update.status })
    .eq('id', id)
    .select(SELECT_QUERY)
    .single()
  if (error) throw error
  await supabase.from('appointment_request_history').insert({
    appointment_request_id: id,
    action: 'Cambio de estado',
    old_status: oldStatus,
    new_status: update.status,
    notes: update.notes || null,
    created_by: userId,
  })
  return data as AppointmentRequest
}

export async function updateAppointment(
  id: string,
  formData: Partial<AppointmentFormData>,
  userId: string
): Promise<AppointmentRequest> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_requests')
    .update(formData)
    .eq('id', id)
    .select(SELECT_QUERY)
    .single()
  if (error) throw error
  await supabase.from('appointment_request_history').insert({
    appointment_request_id: id,
    action: 'Solicitud actualizada',
    notes: 'Se actualizaron los datos de la solicitud',
    created_by: userId,
  })
  return data as AppointmentRequest
}

export async function deleteAppointment(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('appointment_requests').delete().eq('id', id)
  if (error) throw error
}

export async function getAppointmentHistory(
  appointmentId: string
): Promise<AppointmentRequestHistory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointment_request_history')
    .select(`*, user:users(*)`)
    .eq('appointment_request_id', appointmentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as AppointmentRequestHistory[]) || []
}
