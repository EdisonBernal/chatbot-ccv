-- Chatbot Configuration Tables
-- Permite configurar pasos automáticos que el agente ejecuta cuando recibe mensajes

-- Asegura existencia de tabla `clinics` requerida por claves foráneas
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinics_id ON public.clinics(id);

CREATE TYPE chatbot_trigger_type AS ENUM (
  'message_received',
  'keyword',
  'has_pending_appointment',
  'new_patient',
  'after_delay'
);

CREATE TYPE chatbot_action_type AS ENUM (
  'send_message',
  'create_appointment_request',
  'send_reminder',
  'collect_info',
  'redirect_to_agent',
  'update_conversation_status',
  'send_confirmation',
  'schedule_step'
);

-- Tabla: Configuración del chatbot
CREATE TABLE IF NOT EXISTS public.chatbot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  welcome_message TEXT,
  fallback_message TEXT DEFAULT 'Lo siento, no entiendo. ¿Puedo ayudarte de otra forma?',
  escalation_message TEXT DEFAULT 'Conectándote con un agente...',
  max_retries INTEGER DEFAULT 3,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Pasos del flujo del chatbot
CREATE TABLE IF NOT EXISTS public.chatbot_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id UUID NOT NULL REFERENCES public.chatbot_config(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type chatbot_trigger_type NOT NULL,
  trigger_keywords TEXT[], -- Array de palabras clave si trigger_type = 'keyword'
  trigger_delay_minutes INTEGER, -- Minutos de delay si trigger_type = 'after_delay'
  condition_requires_pending_apt BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chatbot_config_id, step_number)
);

-- Tabla: Acciones de cada paso
CREATE TABLE IF NOT EXISTS public.chatbot_step_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_step_id UUID NOT NULL REFERENCES public.chatbot_steps(id) ON DELETE CASCADE,
  action_number INTEGER NOT NULL,
  action_type chatbot_action_type NOT NULL,
  message_template TEXT, -- Para send_message, usar {{nombre}}, {{telefono}}, etc
  appointment_specialty_id UUID REFERENCES public.specialties(id),
  info_field_name TEXT, -- Para collect_info (nombre, email, etc)
  info_field_label TEXT, -- Etiqueta a mostrar
  delay_seconds INTEGER, -- Delay antes de ejecutar esta acción
  redirect_to_agent BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chatbot_step_id, action_number)
);

-- Tabla: Condiciones (IF/THEN) para pasos
CREATE TABLE IF NOT EXISTS public.chatbot_step_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_step_id UUID NOT NULL REFERENCES public.chatbot_steps(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL, -- 'keyword_match', 'time_based', 'user_info'
  condition_value TEXT NOT NULL,
  next_step_number INTEGER, -- Ir al siguiente paso si se cumple
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Historial de ejecuciones del chatbot
CREATE TABLE IF NOT EXISTS public.chatbot_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatbot_config_id UUID REFERENCES public.chatbot_config(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.chatbot_steps(id) ON DELETE SET NULL,
  action_id UUID REFERENCES public.chatbot_step_actions(id) ON DELETE SET NULL,
  trigger_type chatbot_trigger_type,
  action_type chatbot_action_type,
  message_sent TEXT,
  user_response TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Variables del usuario (para personalizar respuestas)
CREATE TABLE IF NOT EXISTS public.chatbot_user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  context_key TEXT NOT NULL,
  context_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, context_key)
);

-- Índices para optimización
CREATE INDEX idx_chatbot_config_clinic ON public.chatbot_config(clinic_id);
CREATE INDEX idx_chatbot_steps_config ON public.chatbot_steps(chatbot_config_id);
CREATE INDEX idx_chatbot_actions_step ON public.chatbot_step_actions(chatbot_step_id);
CREATE INDEX idx_chatbot_logs_conversation ON public.chatbot_execution_logs(conversation_id);
CREATE INDEX idx_chatbot_logs_config ON public.chatbot_execution_logs(chatbot_config_id);
CREATE INDEX idx_chatbot_context_conversation ON public.chatbot_user_context(conversation_id);

-- Triggers para updated_at
-- Función helper para mantener `updated_at`
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER chatbot_config_updated_at
  BEFORE UPDATE ON public.chatbot_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER chatbot_steps_updated_at
  BEFORE UPDATE ON public.chatbot_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER chatbot_actions_updated_at
  BEFORE UPDATE ON public.chatbot_step_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_step_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_step_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Admin only para configuración
CREATE POLICY "admins_manage_chatbot_config" ON public.chatbot_config
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admins_manage_chatbot_steps" ON public.chatbot_steps
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admins_manage_chatbot_actions" ON public.chatbot_step_actions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admins_manage_chatbot_conditions" ON public.chatbot_step_conditions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Admins gestionan clínicas; usuarios autenticados pueden leer
CREATE POLICY "admins_manage_clinics" ON public.clinics
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "authenticated_read_clinics" ON public.clinics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Todos ven logs (para auditoría)
CREATE POLICY "authenticated_read_chatbot_logs" ON public.chatbot_execution_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_chatbot_context" ON public.chatbot_user_context
  FOR SELECT USING (auth.role() = 'authenticated');

-- Guardar contexto en conversaciones propias
CREATE POLICY "authenticated_manage_context" ON public.chatbot_user_context
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.chatbot_config IS 'Configuración principal del chatbot automático';
COMMENT ON TABLE public.chatbot_steps IS 'Pasos secuenciales del flujo del chatbot';
COMMENT ON TABLE public.chatbot_step_actions IS 'Acciones que ejecuta cada paso';
COMMENT ON TABLE public.chatbot_execution_logs IS 'Historial de ejecuciones para auditoría';
COMMENT ON TABLE public.chatbot_user_context IS 'Contexto de usuario para personalizar respuestas';
