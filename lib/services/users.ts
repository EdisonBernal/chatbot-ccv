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
  const { data, error } = await supabase.rpc('get_dashboard_metrics')
  if (error) throw error
  const row = data?.[0]
  return {
    pending_requests: Number(row?.pending_requests ?? 0),
    reviewing_requests: Number(row?.reviewing_requests ?? 0),
    confirmed_requests: Number(row?.confirmed_requests ?? 0),
    cancelled_requests: Number(row?.cancelled_requests ?? 0),
    total_today: Number(row?.total_today ?? 0),
    new_conversations: Number(row?.new_conversations ?? 0),
    in_attention_conversations: Number(row?.in_attention_conversations ?? 0),
  }
}
