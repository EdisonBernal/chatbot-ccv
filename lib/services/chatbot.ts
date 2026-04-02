import { createClient } from '@/lib/supabase/server'
import type {
  ChatbotConfig,
  ChatbotStep,
  ChatbotStepAction,
  ChatbotConfigFormData,
  ChatbotStepFormData,
  ChatbotActionFormData,
  ChatbotExecutionLog,
} from '@/lib/types'

const CONFIG_SELECT = '*, steps:chatbot_steps(*, actions:chatbot_step_actions(*))'

// ============ CHATBOT CONFIG ============

export async function getChatbotConfigs(supabaseClient?: any): Promise<ChatbotConfig[]> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('chatbot_config')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ChatbotConfig[]) || []
}

export async function getChatbotConfigById(id: string, supabaseClient?: any): Promise<ChatbotConfig | null> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('chatbot_config')
    .select(CONFIG_SELECT)
    .eq('id', id)
    .single()
  if (error) return null
  return data as ChatbotConfig
}

export async function createChatbotConfig(
  formData: ChatbotConfigFormData,
  userId: string
): Promise<ChatbotConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chatbot_config')
    .insert({ ...formData, created_by: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotConfig
}

export async function updateChatbotConfig(
  id: string,
  formData: Partial<ChatbotConfigFormData>
): Promise<ChatbotConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chatbot_config')
    .update(formData)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotConfig
}

export async function deleteChatbotConfig(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('chatbot_config').delete().eq('id', id)
  if (error) throw error
}

// ============ CHATBOT STEPS ============

export async function getChatbotSteps(configId: string, supabaseClient?: any): Promise<ChatbotStep[]> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('chatbot_steps')
    .select('*, actions:chatbot_step_actions(*)')
    .eq('chatbot_config_id', configId)
    .order('step_number', { ascending: true })
  if (error) throw error
  return (data as ChatbotStep[]) || []
}

export async function getChatbotStepById(id: string, supabaseClient?: any): Promise<ChatbotStep | null> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('chatbot_steps')
    .select('*, actions:chatbot_step_actions(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as ChatbotStep
}

export async function createChatbotStep(
  configId: string,
  formData: ChatbotStepFormData
): Promise<ChatbotStep> {
  const supabase = await createClient()
  
  // Obtener el siguiente número de paso
  const { data: lastStep } = await supabase
    .from('chatbot_steps')
    .select('step_number')
    .eq('chatbot_config_id', configId)
    .order('step_number', { ascending: false })
    .limit(1)
    .single()

  const nextStepNumber = (lastStep?.step_number || 0) + 1

  const payload: any = {
    chatbot_config_id: configId,
    step_number: nextStepNumber,
    name: formData.name,
    description: formData.description,
    trigger_type: formData.trigger_type,
    trigger_delay_minutes: formData.trigger_delay_minutes ?? null,
    condition_requires_pending_apt: formData.condition_requires_pending_apt,
    goto_step_name: formData.goto_step_name ?? null,
    keyword_routes: formData.keyword_routes ?? null,
    is_active: formData.is_active,
  }

  // trigger_keywords only for keyword trigger; otherwise save as empty array to avoid null mix
  if (formData.trigger_type === 'keyword') {
    payload.trigger_keywords = Array.isArray(formData.trigger_keywords)
      ? formData.trigger_keywords
      : []
  } else {
    payload.trigger_keywords = []
  }

  const { data, error } = await supabase
    .from('chatbot_steps')
    .insert(payload)
    .select('*, actions:chatbot_step_actions(*)')
    .single()
  if (error) throw error
  return data as ChatbotStep
}

export async function updateChatbotStep(
  id: string,
  formData: Partial<ChatbotStepFormData>
): Promise<ChatbotStep> {
  const payload: any = { ...formData }

  if (formData.trigger_type && formData.trigger_type !== 'keyword') {
    payload.trigger_keywords = []
  }

  if (formData.trigger_type === 'keyword') {
    payload.trigger_keywords = Array.isArray(formData.trigger_keywords)
      ? formData.trigger_keywords
      : []
  }

  // Ensure routing fields are included
  if ('goto_step_name' in formData) {
    payload.goto_step_name = formData.goto_step_name ?? null
  }
  if ('keyword_routes' in formData) {
    payload.keyword_routes = formData.keyword_routes ?? null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chatbot_steps')
    .update(payload)
    .eq('id', id)
    .select('*, actions:chatbot_step_actions(*)')
    .single()
  if (error) throw error
  return data as ChatbotStep
}

export async function reorderChatbotSteps(
  configId: string,
  stepIds: string[]
): Promise<void> {
  const supabase = await createClient()
  
  for (let i = 0; i < stepIds.length; i++) {
    const { error } = await supabase
      .from('chatbot_steps')
      .update({ step_number: i + 1 })
      .eq('id', stepIds[i])
    if (error) throw error
  }
}

export async function deleteChatbotStep(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('chatbot_steps').delete().eq('id', id)
  if (error) throw error
}

// ============ CHATBOT ACTIONS ============

export async function getChatbotActions(stepId: string): Promise<ChatbotStepAction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chatbot_step_actions')
    .select('*')
    .eq('chatbot_step_id', stepId)
    .order('action_number', { ascending: true })
  if (error) throw error
  return (data as ChatbotStepAction[]) || []
}

export async function createChatbotAction(
  stepId: string,
  formData: ChatbotActionFormData
): Promise<ChatbotStepAction> {
  const supabase = await createClient()
  
  // Obtener el siguiente número de acción
  const { data: lastAction } = await supabase
    .from('chatbot_step_actions')
    .select('action_number')
    .eq('chatbot_step_id', stepId)
    .order('action_number', { ascending: false })
    .limit(1)
    .single()

  const nextActionNumber = (lastAction?.action_number || 0) + 1

  const payload: any = {
    chatbot_step_id: stepId,
    action_number: nextActionNumber,
    ...formData,
  }

  // Normalize optional UUID fields to null when empty
  if (payload.appointment_specialty_id === '') {
    payload.appointment_specialty_id = null
  }

  if (payload.chatbot_step_id === '') {
    payload.chatbot_step_id = null
  }

  const { data, error } = await supabase
    .from('chatbot_step_actions')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotStepAction
}

export async function updateChatbotAction(
  id: string,
  formData: Partial<ChatbotActionFormData>
): Promise<ChatbotStepAction> {
  const payload: any = { ...formData }

  if (payload.appointment_specialty_id === '') {
    payload.appointment_specialty_id = null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chatbot_step_actions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotStepAction
}

export async function deleteChatbotAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('chatbot_step_actions').delete().eq('id', id)
  if (error) throw error
}

// ============ CHATBOT EXECUTION LOGS ============

export async function getChatbotLogs(conversationId?: string): Promise<ChatbotExecutionLog[]> {
  const supabase = await createClient()
  let query = supabase
    .from('chatbot_execution_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(100)
  
  if (conversationId) {
    query = query.eq('conversation_id', conversationId)
  }
  
  const { data, error } = await query
  if (error) throw error
  return (data as ChatbotExecutionLog[]) || []
}

export async function logChatbotExecution(
  log: {
    conversation_id: string
    chatbot_config_id?: string
    step_id?: string
    action_id?: string
    trigger_type?: string
    action_type?: string
    message_sent?: string
    user_response?: string
    success?: boolean
    error_message?: string
  },
  supabaseClient?: any
): Promise<ChatbotExecutionLog> {
  const supabase = supabaseClient || (await createClient())
  const { data, error } = await supabase
    .from('chatbot_execution_logs')
    .insert(log)
    .select('*')
    .single()
  if (error) throw error
  return data as ChatbotExecutionLog
}

// ============ USER CONTEXT ============

export async function getChatbotContext(conversationId: string, supabaseClient?: any): Promise<Record<string, string>> {
  const supabase = supabaseClient || await createClient()
  const { data, error } = await supabase
    .from('chatbot_user_context')
    .select('context_key, context_value')
    .eq('conversation_id', conversationId)
  
  if (error) throw error
  
  const context: Record<string, string> = {}
  data?.forEach((item: { context_key: string; context_value: string | null }) => {
    if (item.context_value) {
      context[item.context_key] = item.context_value
    }
  })
  return context
}

export async function setChatbotContext(
  conversationId: string,
  key: string,
  value: string,
  supabaseClient?: any
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const { error } = await supabase.from('chatbot_user_context').upsert(
    {
      conversation_id: conversationId,
      context_key: key,
      context_value: value,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'conversation_id,context_key',
    }
  )
  if (error) throw error
}

/**
 * Get the updated_at timestamp of a specific context key.
 */
export async function getChatbotContextTimestamp(
  conversationId: string,
  key: string,
  supabaseClient?: any
): Promise<string | null> {
  const supabase = supabaseClient || (await createClient())
  const { data, error } = await supabase
    .from('chatbot_user_context')
    .select('updated_at')
    .eq('conversation_id', conversationId)
    .eq('context_key', key)
    .maybeSingle()
  if (error || !data) return null
  return data.updated_at || null
}

/**
 * Clear the entire chatbot session for a conversation so the user
 * starts fresh on the next message.
 */
export async function clearChatbotSession(
  conversationId: string,
  supabaseClient?: any
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const { error } = await supabase
    .from('chatbot_user_context')
    .delete()
    .eq('conversation_id', conversationId)
  if (error) throw error
}

/** Internal session keys that should be cleared on flow reset but NOT user responses */
const SESSION_KEYS = ['chatbot_current_step_id', 'chatbot_retry_count']

/**
 * Clear only the internal session state (current step, retry count).
 * Preserves user-collected responses (response_*, collect_info fields, etc.).
 */
export async function clearChatbotSessionState(
  conversationId: string,
  supabaseClient?: any
): Promise<void> {
  const supabase = supabaseClient || (await createClient())
  const { error } = await supabase
    .from('chatbot_user_context')
    .delete()
    .eq('conversation_id', conversationId)
    .in('context_key', SESSION_KEYS)
  if (error) throw error
}
