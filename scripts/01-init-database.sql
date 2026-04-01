-- =====================================================
-- INICIALIZACIÓN DE BASE DE DATOS - CRM CITAS MÉDICAS
-- =====================================================

-- =====================================================
-- 1. EXTENSIONES NECESARIAS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- =====================================================
-- 2. TIPOS ENUM
-- =====================================================
CREATE TYPE user_role AS ENUM ('admin', 'recepcion');
CREATE TYPE appointment_status AS ENUM ('pendiente', 'en_revision', 'confirmada', 'cancelada');
CREATE TYPE conversation_status AS ENUM ('nueva', 'en_atencion', 'cerrada');
CREATE TYPE activity_action AS ENUM ('crear_solicitud', 'cambio_estado', 'agregar_observacion', 'crear_conversacion', 'enviar_mensaje', 'cambio_estado_conversacion');

-- =====================================================
-- 3. TABLA DE USUARIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'recepcion',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. TABLA DE ESPECIALIDADES
-- =====================================================
CREATE TABLE IF NOT EXISTS specialties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 5. TABLA DE EPS
-- =====================================================
CREATE TABLE IF NOT EXISTS eps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 6. TABLA DE PACIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  eps_id uuid REFERENCES eps(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 7. TABLA DE SOLICITUDES DE CITAS
-- =====================================================
CREATE TABLE IF NOT EXISTS appointment_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
  status appointment_status NOT NULL DEFAULT 'pendiente',
  requested_date date,
  internal_notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 8. TABLA DE HISTORIAL DE SOLICITUDES
-- =====================================================
CREATE TABLE IF NOT EXISTS appointment_request_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_request_id uuid NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status appointment_status,
  new_status appointment_status,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 9. TABLA DE CONVERSACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'nueva',
  whatsapp_number text NOT NULL,
  appointment_request_id uuid REFERENCES appointment_requests(id) ON DELETE SET NULL,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 10. TABLA DE MENSAJES DE CONVERSACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('patient', 'staff')),
  sender_id uuid REFERENCES users(id) ON DELETE SET NULL,
  message_text text NOT NULL,
  twilio_sid text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 11. TABLA DE REGISTRO DE ACTIVIDAD DEL SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS system_activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action activity_action NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  description text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================================================
-- 12. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_patients_document ON patients(document_number);
CREATE INDEX idx_patients_phone ON patients(phone_number);
CREATE INDEX idx_appointment_requests_patient ON appointment_requests(patient_id);
CREATE INDEX idx_appointment_requests_specialty ON appointment_requests(specialty_id);
CREATE INDEX idx_appointment_requests_status ON appointment_requests(status);
CREATE INDEX idx_appointment_requests_created_at ON appointment_requests(created_at);
CREATE INDEX idx_appointment_request_history_request ON appointment_request_history(appointment_request_id);
CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_system_activity_logs_user ON system_activity_logs(user_id);
CREATE INDEX idx_system_activity_logs_created_at ON system_activity_logs(created_at);

-- =====================================================
-- 13. CONFIGURAR TRIGGERS PARA UPDATED_AT
-- =====================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON specialties
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER update_eps_updated_at BEFORE UPDATE ON eps
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER update_appointment_requests_updated_at BEFORE UPDATE ON appointment_requests
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- =====================================================
-- 14. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- =====================================================
-- RLS: TABLA USERS
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver su propio perfil, excepto admins que ven a todos
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- Solo admins pueden crear usuarios
CREATE POLICY "Only admins can create users" ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar usuarios
CREATE POLICY "Only admins can update users" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- =====================================================
-- RLS: TABLA SPECIALTIES
-- =====================================================
ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver especialidades
CREATE POLICY "Authenticated users can view specialties" ON specialties
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear especialidades
CREATE POLICY "Only admins can create specialties" ON specialties
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar especialidades
CREATE POLICY "Only admins can update specialties" ON specialties
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- =====================================================
-- RLS: TABLA EPS
-- =====================================================
ALTER TABLE eps ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver EPS
CREATE POLICY "Authenticated users can view eps" ON eps
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admins pueden crear EPS
CREATE POLICY "Only admins can create eps" ON eps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar EPS
CREATE POLICY "Only admins can update eps" ON eps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- =====================================================
-- RLS: TABLA PATIENTS
-- =====================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver pacientes
CREATE POLICY "Authenticated users can view patients" ON patients
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear pacientes
CREATE POLICY "Authenticated users can create patients" ON patients
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden actualizar pacientes
CREATE POLICY "Authenticated users can update patients" ON patients
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- RLS: TABLA APPOINTMENT_REQUESTS
-- =====================================================
ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver solicitudes
CREATE POLICY "Authenticated users can view appointment requests" ON appointment_requests
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear solicitudes
CREATE POLICY "Authenticated users can create appointment requests" ON appointment_requests
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden actualizar solicitudes
CREATE POLICY "Authenticated users can update appointment requests" ON appointment_requests
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- RLS: TABLA APPOINTMENT_REQUEST_HISTORY
-- =====================================================
ALTER TABLE appointment_request_history ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver el historial
CREATE POLICY "Authenticated users can view request history" ON appointment_request_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden agregar al historial
CREATE POLICY "Authenticated users can create history entries" ON appointment_request_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- RLS: TABLA CONVERSATIONS
-- =====================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver conversaciones
CREATE POLICY "Authenticated users can view conversations" ON conversations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear conversaciones
CREATE POLICY "Authenticated users can create conversations" ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden actualizar conversaciones
CREATE POLICY "Authenticated users can update conversations" ON conversations
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- RLS: TABLA CONVERSATION_MESSAGES
-- =====================================================
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver mensajes
CREATE POLICY "Authenticated users can view messages" ON conversation_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Todos los usuarios autenticados pueden crear mensajes
CREATE POLICY "Authenticated users can create messages" ON conversation_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- RLS: TABLA SYSTEM_ACTIVITY_LOGS
-- =====================================================
ALTER TABLE system_activity_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver el registro de actividad
CREATE POLICY "Only admins can view activity logs" ON system_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = auth_id AND role = 'admin'
    )
  );

-- Solo el sistema (stored procedures) puede crear logs
CREATE POLICY "Only authenticated users can create activity logs" ON system_activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 15. FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para registrar actividad del sistema
CREATE OR REPLACE FUNCTION log_system_activity(
  p_action activity_action,
  p_entity_type text,
  p_entity_id uuid,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_user_id uuid;
BEGIN
  -- Obtener el usuario autenticado
  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();
  
  INSERT INTO system_activity_logs (user_id, action, entity_type, entity_id, description, metadata)
  VALUES (v_user_id, p_action, p_entity_type, p_entity_id, p_description, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar last_message_at en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- 16. FUNCIÓN PARA OBTENER MÉTRICAS DEL DASHBOARD
-- =====================================================
CREATE OR REPLACE FUNCTION get_dashboard_metrics()
RETURNS TABLE (
  pending_requests bigint,
  reviewing_requests bigint,
  confirmed_requests bigint,
  cancelled_requests bigint,
  total_today bigint,
  new_conversations bigint,
  in_attention_conversations bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM appointment_requests WHERE status = 'pendiente') as pending_requests,
    (SELECT COUNT(*) FROM appointment_requests WHERE status = 'en_revision') as reviewing_requests,
    (SELECT COUNT(*) FROM appointment_requests WHERE status = 'confirmada') as confirmed_requests,
    (SELECT COUNT(*) FROM appointment_requests WHERE status = 'cancelada') as cancelled_requests,
    (SELECT COUNT(*) FROM appointment_requests WHERE DATE(created_at) = CURRENT_DATE) as total_today,
    (SELECT COUNT(*) FROM conversations WHERE status = 'nueva') as new_conversations,
    (SELECT COUNT(*) FROM conversations WHERE status = 'en_atencion') as in_attention_conversations;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIN DEL SCRIPT DE INICIALIZACIÓN
-- =====================================================
