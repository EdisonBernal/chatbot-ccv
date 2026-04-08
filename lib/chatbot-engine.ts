import { createClient } from '@/lib/supabase/server'
import {
  getChatbotConfigById,
  getChatbotSteps,
  getChatbotContext,
  setChatbotContext,
  getChatbotContextTimestamp,
  clearChatbotSessionState,
  logChatbotExecution,
} from '@/lib/services/chatbot'
import { sendMessageWithWhatsApp, getConversationById, broadcastConversationStatusChange } from '@/lib/services/conversations'
import type { ChatbotConfig, ChatbotStep, ChatbotStepAction } from '@/lib/types'

/** Session expires after 30 minutes of inactivity */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

export interface ChatbotProcessingOptions {
  conversationId: string
  message?: string
  triggerType?: string
}

export class ChatbotEngine {
  private supabase: any
  private conversationId: string
  private userContext: Record<string, string> = {}
  private executionLog: any[] = []

  constructor(conversationId: string, supabaseClient?: any) {
    this.conversationId = conversationId
    this.supabase = supabaseClient
  }

  /**
   * Inicializa el motor
   */
  async initialize() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    this.userContext = await getChatbotContext(this.conversationId, this.supabase)
  }

  /**
   * Build a numbered list of valid options for a keyword step.
   * E.g. "1. Agendar cita\n2. Ver horarios\n3. Hablar con agente"
   */
  private buildOptionsText(step: ChatbotStep): string {
    if (!step.trigger_keywords || step.trigger_keywords.length === 0) return ''
    return step.trigger_keywords
      .map((kw, i) => `${i + 1}. ${kw}`)
      .join('\n')
  }

  /**
   * Determines whether an action should execute on entry (navigation to step)
   * vs on response (when user message matches trigger).
   */
  private isEntryAction(actionType: string): boolean {
    return actionType === 'send_message' || actionType === 'send_reminder' || actionType === 'send_confirmation'
  }

  /**
   * Execute only the "entry" actions of a step (send_message, send_reminder, send_confirmation).
   * Called when the engine navigates to a new step.
   */
  private async executeEntryActions(
    step: ChatbotStep,
    config: ChatbotConfig,
  ): Promise<void> {
    for (const action of step.actions || []) {
      if (!action.is_active) continue
      if (!this.isEntryAction(action.action_type)) continue

      await this.executeAction(action, config, '')

      await logChatbotExecution(
        {
          conversation_id: this.conversationId,
          chatbot_config_id: config.id,
          step_id: step.id,
          action_id: action.id,
          trigger_type: step.trigger_type,
          action_type: action.action_type,
          success: true,
        },
        this.supabase
      )
    }
  }

  /**
   * Execute only the "response" actions (collect_info, redirect_to_agent, create_appointment_request, etc.)
   * Called when the user's message matches the step's trigger.
   */
  private async executeResponseActions(
    step: ChatbotStep,
    config: ChatbotConfig,
    userMessage: string,
  ): Promise<void> {
    for (const action of step.actions || []) {
      if (!action.is_active) continue
      if (this.isEntryAction(action.action_type)) continue

      await this.executeAction(action, config, userMessage)

      await logChatbotExecution(
        {
          conversation_id: this.conversationId,
          chatbot_config_id: config.id,
          step_id: step.id,
          action_id: action.id,
          trigger_type: step.trigger_type,
          action_type: action.action_type,
          success: true,
        },
        this.supabase
      )
    }
  }

  /**
   * Determine the next step using routing:
   * 1. keyword_routes (per-keyword branching)
   * 2. goto_step_name (default route)
   * 3. Sequential (next step_number)
   */
  private resolveNextStep(
    currentStep: ChatbotStep,
    steps: ChatbotStep[],
    matchedKeyword: string | null,
  ): ChatbotStep | undefined {
    // 1. Per-keyword routing
    if (matchedKeyword && currentStep.keyword_routes) {
      const targetName = currentStep.keyword_routes[matchedKeyword]
      if (targetName) {
        const target = steps.find(s => s.name === targetName && s.is_active)
        if (target) return target
      }
    }

    // 2. Default goto
    if (currentStep.goto_step_name) {
      const target = steps.find(s => s.name === currentStep.goto_step_name && s.is_active)
      if (target) return target
    }

    // 3. Sequential fallback
    return steps
      .filter(s => s.is_active)
      .find(s => s.step_number > currentStep.step_number)
  }

  /**
   * Navigate to a step: execute its entry actions and save as current.
   */
  private async navigateToStep(
    step: ChatbotStep,
    config: ChatbotConfig,
  ): Promise<void> {
    await this.executeEntryActions(step, config)
    await setChatbotContext(this.conversationId, 'chatbot_current_step_id', step.id, this.supabase)
  }

  /**
   * Procesa un mensaje y ejecuta el chatbot correspondiente
   */
  async processMessage(message: string, config: ChatbotConfig): Promise<void> {
    try {
      await this.initialize()

      const steps = await getChatbotSteps(config.id, this.supabase)
      if (!steps.length) return

      const conversation = await getConversationById(this.conversationId, this.supabase)
      if (!conversation) return

      // ── Session timeout check ──────────────────────────────────
      const wasFreshSession = !this.userContext['chatbot_current_step_id']
      let currentStepId = this.userContext['chatbot_current_step_id']

      if (currentStepId) {
        const lastUpdated = await getChatbotContextTimestamp(
          this.conversationId, 'chatbot_current_step_id', this.supabase
        )
        const elapsed = lastUpdated
          ? Date.now() - new Date(lastUpdated).getTime()
          : Infinity

        if (elapsed > SESSION_TIMEOUT_MS) {
          await clearChatbotSessionState(this.conversationId, this.supabase)
          this.userContext = {}
          currentStepId = undefined as any
        }
      }

      // ── Try to continue current step (mid-flow) ────────────────
      let selectedStep: ChatbotStep | undefined
      let matchedKeyword: string | null = null

      if (currentStepId) {
        const currentStep = steps.find(step => step.id === currentStepId && step.is_active)
        if (currentStep) {
          const shouldExecute = this.checkTrigger(currentStep, message, conversation)
          if (shouldExecute) {
            // Reset retry counter on valid input
            await setChatbotContext(this.conversationId, 'chatbot_retry_count', '0', this.supabase)
            // Save meaningful response (keyword text, not the number typed)
            if (currentStep.trigger_type === 'keyword') {
              matchedKeyword = this.getKeywordMatch(currentStep, message)
              if (matchedKeyword) {
                const safeKey = `response_${currentStep.name.replace(/\s+/g, '_').toLowerCase()}`
                await setChatbotContext(this.conversationId, safeKey, matchedKeyword, this.supabase)
              }
            } else if (currentStep.trigger_type === 'message_received' && message.trim()) {
              const safeKey = `response_${currentStep.name.replace(/\s+/g, '_').toLowerCase()}`
              await setChatbotContext(this.conversationId, safeKey, message.trim(), this.supabase)
            }
            selectedStep = currentStep
          } else if (currentStep.trigger_type === 'keyword') {
            // ── Invalid input: track retries ──────────────────────
            const retryCount = parseInt(this.userContext['chatbot_retry_count'] || '0', 10) + 1
            await setChatbotContext(this.conversationId, 'chatbot_retry_count', String(retryCount), this.supabase)

            if (retryCount >= (config.max_retries || 3)) {
              await clearChatbotSessionState(this.conversationId, this.supabase)
              await this.redirectToAgent(config.escalation_message)
              return
            }

            // Show the valid options so the user knows what to type
            const options = this.buildOptionsText(currentStep)
            const hint = options
              ? `Opción no válida. Por favor elige una opción:\n\n${options}`
              : 'Opción no válida. Por favor intenta de nuevo.'
            await this.sendMessage(hint, message)
            return
          }
        }
      }

      // ── No current step or step didn't match — scan all steps ───
      if (!selectedStep) {
        const matchingSteps: ChatbotStep[] = []

        for (const step of steps) {
          if (!step.is_active) continue
          const shouldExecute = this.checkTrigger(step, message, conversation)
          if (shouldExecute) matchingSteps.push(step)
        }

        selectedStep = matchingSteps.find(step => step.trigger_type !== 'message_received')
          || matchingSteps.find(step => step.trigger_type === 'message_received')

        // Get matched keyword for the scanned step
        if (selectedStep?.trigger_type === 'keyword') {
          matchedKeyword = this.getKeywordMatch(selectedStep, message)
          if (matchedKeyword) {
            const safeKey = `response_${selectedStep.name.replace(/\s+/g, '_').toLowerCase()}`
            await setChatbotContext(this.conversationId, safeKey, matchedKeyword, this.supabase)
          }
        } else if (selectedStep?.trigger_type === 'message_received' && message.trim()) {
          const safeKey = `response_${selectedStep.name.replace(/\s+/g, '_').toLowerCase()}`
          await setChatbotContext(this.conversationId, safeKey, message.trim(), this.supabase)
        }
      }

      if (selectedStep) {
        // Reset retry counter when entering a new step
        await setChatbotContext(this.conversationId, 'chatbot_retry_count', '0', this.supabase)

        // When starting a fresh session (no previous step), execute the matched
        // step's entry actions first so that the welcome/greeting message is
        // shown before navigating onwards.
        if (wasFreshSession) {
          await this.executeEntryActions(selectedStep, config)
        }

        // Execute response actions (collect_info, redirect_to_agent, etc.)
        await this.executeResponseActions(selectedStep, config, message)

        // Reload context after response actions (collect_info may have updated it)
        this.userContext = await getChatbotContext(this.conversationId, this.supabase)

        // ── Route to next step ───────────────────────────────
        const nextStep = this.resolveNextStep(selectedStep, steps, matchedKeyword)

        if (nextStep) {
          await this.navigateToStep(nextStep, config)
        } else {
          // Flow completed — clear session state but keep collected responses
          await clearChatbotSessionState(this.conversationId, this.supabase)
        }
        return
      }

      // ── No step matched — send fallback ─────────────────────────
      if (config.fallback_message) {
        await this.sendMessage(config.fallback_message, message || '')
        await logChatbotExecution(
          {
            conversation_id: this.conversationId,
            chatbot_config_id: config.id,
            message_sent: config.fallback_message,
            success: true,
          },
          this.supabase
        )
      }
    } catch (error) {
      await logChatbotExecution(
        {
          conversation_id: this.conversationId,
          message_sent: 'Error procesando mensaje',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        },
        this.supabase
      )
    }
  }

  /**
   * Verifica si el trigger del paso se cumple
   */
  private getKeywordMatch(step: ChatbotStep, message: string): string | null {
    if (!step.trigger_keywords || step.trigger_keywords.length === 0) return null

    const trimmed = message.trim()
    const lowerMessage = trimmed.toLowerCase()

    // Exact keyword match or contains
    for (const kw of step.trigger_keywords) {
      if (!kw) continue
      const lowerKw = kw.toLowerCase()
      if (lowerMessage === lowerKw || lowerMessage.includes(lowerKw)) {
        return kw
      }
    }

    // Numeric index matching (1-indexed)
    const numeric = parseInt(trimmed, 10)
    if (!Number.isNaN(numeric) && numeric > 0 && numeric <= step.trigger_keywords.length) {
      return step.trigger_keywords[numeric - 1]
    }

    return null
  }

  private checkTrigger(
    step: ChatbotStep,
    message: string,
    conversation: any
  ): boolean {
    switch (step.trigger_type) {
      case 'message_received':
        return true

      case 'keyword':
        return this.getKeywordMatch(step, message) !== null

      case 'has_pending_appointment':
        return conversation.has_pending_appointment === true

      case 'new_patient':
        return conversation.is_new_patient === true

      case 'after_delay':
        // Este se ejecuta por scheduler, no por mensaje
        return false

      default:
        return false
    }
  }

  /**
   * Ejecuta una acción
   */
  private async executeAction(
    action: ChatbotStepAction,
    config: ChatbotConfig,
    userMessage: string
  ): Promise<void> {
    const delaySeconds = action.delay_seconds
    if (delaySeconds != null && delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    }

    switch (action.action_type) {
      case 'send_message':
        await this.sendMessage(action.message_template || '', userMessage)
        break

      case 'create_appointment_request':
        await this.createAppointmentRequest(action.appointment_specialty_id || '')
        break

      case 'collect_info':
        await this.collectInfo(
          action.info_field_name || '',
          action.info_field_label || '',
          userMessage
        )
        break

      case 'redirect_to_agent':
        await this.redirectToAgent(config.escalation_message)
        break

      case 'update_conversation_status':
        // Implementar según necesidad
        break

      case 'send_reminder':
        await this.sendMessage(action.message_template || '', userMessage)
        break

      case 'send_confirmation':
        await this.sendMessage(action.message_template || '', userMessage)
        break

      case 'schedule_step':
        // Programar paso para después
        break
    }
  }

  /**
   * Envía un mensaje con variables interpoladas
   */
  private async sendMessage(template: string, userMessage: string): Promise<void> {
    let message = template

    // Reemplazar variables dinámicas
    for (const [key, value] of Object.entries(this.userContext)) {
      const placeholder = `{{${key}}}` 
      message = message.replace(new RegExp(placeholder, 'g'), value || '')
    }

    // Send typing indicator before responding
    await this.sendTypingIndicator()

    // Enviar mensaje vía WhatsApp Cloud API + guardar en DB
    await sendMessageWithWhatsApp(this.conversationId, message, this.supabase)
  }

  /**
   * Send typing indicator to WhatsApp so user sees "typing..." bubble
   */
  private async sendTypingIndicator(): Promise<void> {
    try {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
      if (!phoneNumberId || !accessToken) return

      // Get the last patient message wamid
      const { data: lastMsg } = await this.supabase
        .from('conversation_messages')
        .select('twilio_sid')
        .eq('conversation_id', this.conversationId)
        .eq('sender_type', 'patient')
        .not('twilio_sid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastMsg?.twilio_sid) return

      await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: lastMsg.twilio_sid,
          typing_indicator: { type: 'text' },
        }),
      })
    } catch {
      // Typing indicator is best-effort, don't fail the message send
    }
  }

  /**
   * Crea una solicitud de cita
   */
  private async createAppointmentRequest(specialtyId: string): Promise<void> {
    try {
      const conversation = await getConversationById(this.conversationId)
      if (!conversation) return

      // Crear solicitud
      const { error } = await this.supabase
        .from('appointment_requests')
        .insert({
          conversation_id: this.conversationId,
          patient_id: conversation.patient_id,
          specialty_id: specialtyId,
          status: 'pendiente',
          notes: 'Solicitud creada automáticamente por chatbot',
        })

      if (error) throw error
    } catch {
      // ignore
    }
  }

  /**
   * Recopila información del usuario
   */
  private async collectInfo(fieldName: string, _fieldLabel: string, userMessage: string): Promise<void> {
    try {
      // Guardar la respuesta real del usuario, no la etiqueta del campo
      const value = userMessage.trim() || _fieldLabel
      await setChatbotContext(this.conversationId, fieldName, value, this.supabase)
      this.userContext[fieldName] = value
    } catch {
      // ignore
    }
  }

  /**
   * Redirige a un agente
   */
  private async redirectToAgent(message: string): Promise<void> {
    try {
      // Enviar mensaje de escalación
      await this.sendMessage(message, '')

      // Actualizar estado conversación
      const { error } = await this.supabase
        .from('conversations')
        .update({ status: 'en_atencion' })
        .eq('id', this.conversationId)

      if (error) throw error

      // Broadcast status change so the UI updates in realtime
      try {
        await broadcastConversationStatusChange(this.conversationId, 'en_atencion', this.supabase)
      } catch {
        // ignore broadcast failures
      }
    } catch {
      // ignore
    }
  }
}
