import { createClient } from '@/lib/supabase/server'
import {
  getChatbotConfigById,
  getChatbotSteps,
  getChatbotContext,
  setChatbotContext,
  logChatbotExecution,
} from '@/lib/services/chatbot'
import { sendMessageWithTwilio, getConversationById } from '@/lib/services/conversations'
import type { ChatbotConfig, ChatbotStep, ChatbotStepAction } from '@/lib/types'

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
   * Procesa un mensaje y ejecuta el chatbot correspondiente
   */
  async processMessage(message: string, config: ChatbotConfig): Promise<void> {
    try {
      await this.initialize()

      const steps = await getChatbotSteps(config.id, this.supabase)
      console.log('[ChatbotEngine] config', config.id, 'steps', steps.length, 'message', message)
      if (!steps.length) {
        console.log('[ChatbotEngine] no steps found')
        return
      }

      const conversation = await getConversationById(this.conversationId, this.supabase)
      if (!conversation) {
        console.log('[ChatbotEngine] conversation not found', this.conversationId)
        return
      }

      const currentStepId = this.userContext['chatbot_current_step_id']
      let selectedStep: ChatbotStep | undefined

      if (currentStepId) {
        const currentStep = steps.find(step => step.id === currentStepId && step.is_active)
        if (currentStep) {
          const shouldExecute = this.checkTrigger(currentStep, message, conversation)
          if (shouldExecute) {
            selectedStep = currentStep
          } else if (currentStep.trigger_type === 'keyword') {
            await this.sendMessage('Opción no válida. Por favor intenta de nuevo.', message)
            return
          }
        }
      }

      if (!selectedStep) {
        const matchingSteps: ChatbotStep[] = []

        for (const step of steps) {
          if (!step.is_active) continue
          const shouldExecute = this.checkTrigger(step, message, conversation)
          if (shouldExecute) matchingSteps.push(step)
        }

        selectedStep = matchingSteps.find(step => step.trigger_type !== 'message_received')
          || matchingSteps.find(step => step.trigger_type === 'message_received')
      }

      if (selectedStep) {
        console.log('[ChatbotEngine] selected step', selectedStep.id, 'trigger', selectedStep.trigger_type)

        for (const action of selectedStep.actions || []) {
          if (!action.is_active) continue

          await this.executeAction(action, config, message)

          await logChatbotExecution(
            {
              conversation_id: this.conversationId,
              chatbot_config_id: config.id,
              step_id: selectedStep.id,
              action_id: action.id,
              trigger_type: selectedStep.trigger_type,
              action_type: action.action_type,
              success: true,
            },
            this.supabase
          )
        }

        // Avanzar al siguiente paso en orden (en flujo secuencial)
        const nextStep = steps
          .filter(step => step.is_active)
          .find(step => step.step_number > selectedStep.step_number)

        if (nextStep) {
          await setChatbotContext(this.conversationId, 'chatbot_current_step_id', nextStep.id, this.supabase)
        } else {
          await setChatbotContext(this.conversationId, 'chatbot_current_step_id', '', this.supabase)
        }
        return
      }

      // Si no coincidió ningún paso, enviar mensaje por defecto
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
      console.error('[ChatbotEngine] Error processing message:', error)
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
          action.info_field_label || ''
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

    // Enviar mensaje vía Twilio + guardar en DB
    await sendMessageWithTwilio(this.conversationId, message, this.supabase)
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
    } catch (error) {
      console.error('[ChatbotEngine] Error creating appointment:', error)
    }
  }

  /**
   * Recopila información del usuario
   */
  private async collectInfo(fieldName: string, fieldLabel: string): Promise<void> {
    try {
      // Guardar en contexto para usar después
      await setChatbotContext(this.conversationId, fieldName, fieldLabel, this.supabase)
      this.userContext[fieldName] = fieldLabel
    } catch (error) {
      console.error('[ChatbotEngine] Error collecting info:', error)
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
    } catch (error) {
      console.error('[ChatbotEngine] Error redirecting to agent:', error)
    }
  }
}
