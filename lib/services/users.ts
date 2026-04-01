import { createClient } from '@/lib/supabase/server'
import type { User, UserFormData, DashboardMetrics } from '@/lib/types'

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()
  if (error) return null
  return data as User
}

export async function getUsers(): Promise<User[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) throw error
  return data as User[]
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error) return null
  return data as User
}

export async function updateUser(
  id: string,
  formData: Partial<UserFormData>
): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update(formData)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as User
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    newConvs,
    inAttentionConvs,
    closedConvs,
    totalConvs,
    convsToday,
    msgsToday,
    botMsgsToday,
    appointmentsToday,
  ] = await Promise.all([
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'nueva'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'en_atencion'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'cerrada'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('conversation_messages').select('*', { count: 'exact', head: true }).gte('created_at', today),
    supabase.from('conversation_messages').select('*', { count: 'exact', head: true }).eq('sender_type', 'staff').is('sender_id', null).gte('created_at', today),
    supabase.from('appointment_requests').select('*', { count: 'exact', head: true }).gte('created_at', today),
  ])

  return {
    new_conversations: newConvs.count ?? 0,
    in_attention_conversations: inAttentionConvs.count ?? 0,
    closed_conversations: closedConvs.count ?? 0,
    total_conversations: totalConvs.count ?? 0,
    conversations_today: convsToday.count ?? 0,
    messages_today: msgsToday.count ?? 0,
    bot_messages_today: botMsgsToday.count ?? 0,
    appointments_today: appointmentsToday.count ?? 0,
  }
}
