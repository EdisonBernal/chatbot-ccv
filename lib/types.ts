// =====================================================
// TIPOS TYPESCRIPT - CRM CITAS MÉDICAS
// =====================================================

export type UserRole = 'admin' | 'recepcion'
export type AppointmentStatus = 'pendiente' | 'en_revision' | 'confirmada' | 'cancelada'
export type ConversationStatus = 'nueva' | 'en_atencion' | 'cerrada'
export type SenderType = 'patient' | 'staff'
export type ActivityAction =
  | 'crear_solicitud'
  | 'cambio_estado'
  | 'agregar_observacion'
  | 'crear_conversacion'
  | 'enviar_mensaje'
  | 'cambio_estado_conversacion'

export interface User {
  id: string
  auth_id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Specialty {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EPS {
  id: string
  name: string
  description: string | null
  code?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  document_number: string
  full_name: string
  phone_number: string
  email: string | null
  eps_id: string | null
  eps?: EPS
  created_at: string
  updated_at: string
}

export interface AppointmentRequest {
  id: string
  patient_id: string
  specialty_id: string
  status: AppointmentStatus
  requested_date: string | null
  internal_notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  patient?: Patient
  specialty?: Specialty
  creator?: User
}

export interface AppointmentRequestHistory {
  id: string
  appointment_request_id: string
  action: string
  old_status: AppointmentStatus | null
  new_status: AppointmentStatus | null
  notes: string | null
  created_by: string
  created_at: string
  user?: User
}

export interface Conversation {
  id: string
  patient_id: string | null
  status: ConversationStatus
  whatsapp_number: string
  conversation_sid: string | null
  appointment_request_id: string | null
  last_message: string | null
  last_message_at: string | null
  last_view_at: string | null
  unread_count?: number
  created_at: string
  updated_at: string
  patient?: Patient
  appointment_request?: AppointmentRequest
  messages?: ConversationMessage[]
}

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  message_text: string
  twilio_sid: string | null
  message_index: number | null
  delivery_status: MessageDeliveryStatus
  created_at: string
  sender?: User
}

export interface SystemActivityLog {
  id: string
  user_id: string
  action: ActivityAction
  entity_type: string
  entity_id: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user?: User
}

export interface DashboardMetrics {
  new_conversations: number
  in_attention_conversations: number
  closed_conversations: number
  total_conversations: number
  conversations_today: number
  messages_today: number
  bot_messages_today: number
  appointments_today: number
}

// =====================================================
// TIPOS PARA FORMULARIOS
// =====================================================
export interface PatientFormData {
  document_number: string
  full_name: string
  phone_number: string
  email?: string
  eps_id?: string
}

export interface AppointmentFormData {
  patient_id: string
  specialty_id: string
  requested_date?: string
  internal_notes?: string
}

export interface AppointmentStatusUpdate {
  status: AppointmentStatus
  notes?: string
}

export interface ConversationFormData {
  patient_id: string
  whatsapp_number: string
  appointment_request_id?: string
}

export interface MessageFormData {
  message_text: string
}

export interface UserFormData {
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  password?: string
}

export interface SpecialtyFormData {
  name: string
  description?: string
  is_active: boolean
}

export interface EPSFormData {
  name: string
  description?: string
  is_active: boolean
}

// =====================================================
// CONSTANTES DE ESTADO
// =====================================================
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En Revisión',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
}

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
  en_revision: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelada: 'bg-red-100 text-red-800 border-red-200',
}

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  nueva: 'Nueva',
  en_atencion: 'En Atención',
  cerrada: 'Cerrada',
}

export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string> = {
  nueva: 'bg-blue-100 text-blue-800 border-blue-200',
  en_atencion: 'bg-amber-100 text-amber-800 border-amber-200',
  cerrada: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  recepcion: 'Recepción',
}

// =====================================================
// TIPOS CHATBOT
// =====================================================

export type ChatbotTriggerType =
  | 'message_received'
  | 'keyword'
  | 'has_pending_appointment'
  | 'new_patient'
  | 'after_delay'

export type ChatbotActionType =
  | 'send_message'
  | 'create_appointment_request'
  | 'send_reminder'
  | 'collect_info'
  | 'redirect_to_agent'
  | 'update_conversation_status'
  | 'send_confirmation'
  | 'schedule_step'

export interface ChatbotConfig {
  id: string
  clinic_id: string | null
  name: string
  description: string | null
  is_active: boolean
  welcome_message: string | null
  fallback_message: string
  escalation_message: string
  max_retries: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChatbotStep {
  id: string
  chatbot_config_id: string
  step_number: number
  name: string
  description: string | null
  trigger_type: ChatbotTriggerType
  trigger_keywords: string[] | null
  trigger_delay_minutes: number | null
  condition_requires_pending_apt: boolean
  goto_step_name: string | null
  keyword_routes: Record<string, string> | null
  is_active: boolean
  created_at: string
  updated_at: string
  actions?: ChatbotStepAction[]
}

export interface ChatbotStepAction {
  id: string
  chatbot_step_id: string
  action_number: number
  action_type: ChatbotActionType
  message_template: string | null
  appointment_specialty_id: string | null
  info_field_name: string | null
  info_field_label: string | null
  delay_seconds?: number
  redirect_to_agent: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChatbotExecutionLog {
  id: string
  conversation_id: string
  chatbot_config_id: string | null
  step_id: string | null
  action_id: string | null
  trigger_type: ChatbotTriggerType | null
  action_type: ChatbotActionType | null
  message_sent: string | null
  user_response: string | null
  success: boolean
  error_message: string | null
  executed_at: string
}

export interface ChatbotUserContext {
  id: string
  conversation_id: string
  context_key: string
  context_value: string | null
  created_at: string
  updated_at: string
}

// Formularios
export interface ChatbotConfigFormData {
  name: string
  description: string | null
  is_active: boolean
  welcome_message: string | null
  fallback_message: string
  escalation_message: string
  max_retries: number
}

export interface ChatbotStepFormData {
  name: string
  description: string | null
  trigger_type: ChatbotTriggerType
  trigger_keywords: string[] | null
  trigger_delay_minutes: number | null
  condition_requires_pending_apt: boolean
  goto_step_name: string | null
  keyword_routes: Record<string, string> | null
  is_active: boolean
}

export interface ChatbotActionFormData {
  action_type: ChatbotActionType
  message_template: string | null
  appointment_specialty_id: string | null
  info_field_name: string | null
  info_field_label: string | null
  delay_seconds?: number
  redirect_to_agent: boolean
  is_active: boolean
}

// Labels y colores
export const CHATBOT_TRIGGER_LABELS: Record<ChatbotTriggerType, string> = {
  message_received: 'Mensaje Recibido',
  keyword: 'Palabra Clave',
  has_pending_appointment: 'Tiene Cita Pendiente',
  new_patient: 'Paciente Nuevo',
  after_delay: 'Después de Retardo',
}

export const CHATBOT_ACTION_LABELS: Record<ChatbotActionType, string> = {
  send_message: 'Enviar Mensaje',
  create_appointment_request: 'Crear Solicitud de Cita',
  send_reminder: 'Enviar Recordatorio',
  collect_info: 'Recopilar Información',
  redirect_to_agent: 'Derivar a Agente',
  update_conversation_status: 'Actualizar Estado Conversación',
  send_confirmation: 'Enviar Confirmación',
  schedule_step: 'Programar Paso',
}
