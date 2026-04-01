-- =====================================================
-- DATOS DE EJEMPLO - CRM CITAS MÉDICAS
-- =====================================================

-- =====================================================
-- 1. INSERTAR ESPECIALIDADES
-- =====================================================
INSERT INTO specialties (name, description, is_active) VALUES
('Cardiología', 'Especialidad médica del corazón y vasos sanguíneos', true),
('Dermatología', 'Especialidad de enfermedades de la piel', true),
('Gastroenterología', 'Especialidad del sistema digestivo', true),
('Neurología', 'Especialidad del sistema nervioso', true),
('Pediatría', 'Especialidad en medicina infantil', true),
('Oftalmología', 'Especialidad de enfermedades oculares', true),
('Ortopedia', 'Especialidad de huesos y articulaciones', true),
('Psicología', 'Especialidad de salud mental', true),
('Odontología', 'Especialidad de salud dental', true),
('Ginecología', 'Especialidad de salud reproductiva femenina', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. INSERTAR EPS
-- =====================================================
INSERT INTO eps (name, description, is_active) VALUES
('Aseguradora Salud Plus', 'EPS líder en el mercado', true),
('Seguros Médicos Integral', 'Cobertura completa en servicios médicos', true),
('Plan Salud Colombia', 'Planes flexibles y accesibles', true),
('Médica Total', 'Amplia red de proveedores', true),
('Vida Segura EPS', 'Protección y bienestar para tu familia', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. INSERTAR PACIENTES DE EJEMPLO
-- =====================================================
INSERT INTO patients (document_number, full_name, phone_number, email, eps_id) VALUES
('1234567890', 'Juan Pérez García', '+573001234567', 'juan.perez@email.com', 
  (SELECT id FROM eps WHERE name = 'Aseguradora Salud Plus' LIMIT 1)),
('9876543210', 'María López Martínez', '+573009876543', 'maria.lopez@email.com',
  (SELECT id FROM eps WHERE name = 'Seguros Médicos Integral' LIMIT 1)),
('1111111111', 'Carlos Rodríguez Sánchez', '+573115555555', 'carlos.rodriguez@email.com',
  (SELECT id FROM eps WHERE name = 'Plan Salud Colombia' LIMIT 1)),
('2222222222', 'Ana Fernández Ruiz', '+573117777777', 'ana.fernandez@email.com',
  (SELECT id FROM eps WHERE name = 'Médica Total' LIMIT 1)),
('3333333333', 'David Morales Díaz', '+573119999999', 'david.morales@email.com',
  (SELECT id FROM eps WHERE name = 'Vida Segura EPS' LIMIT 1)),
('4444444444', 'Laura Gómez Castro', '+573002222222', 'laura.gomez@email.com',
  (SELECT id FROM eps WHERE name = 'Aseguradora Salud Plus' LIMIT 1)),
('5555555555', 'Pedro Jiménez Luna', '+573003333333', 'pedro.jimenez@email.com',
  (SELECT id FROM eps WHERE name = 'Seguros Médicos Integral' LIMIT 1)),
('6666666666', 'Sofía Álvarez Rojas', '+573004444444', 'sofia.alvarez@email.com',
  (SELECT id FROM eps WHERE name = 'Plan Salud Colombia' LIMIT 1))
ON CONFLICT (document_number) DO NOTHING;

-- =====================================================
-- 4. SOLICITUDES DE CITAS DE EJEMPLO
-- =====================================================
-- Nota: Estos ejemplos asumen que ya existen usuarios en la tabla users
-- En producción, estos se crearán a través del sistema de autenticación

-- Obtener un usuario de ejemplo (asume que ya hay al menos uno)
-- Las solicitudes se crearán con el usuario actual del sistema

-- Ejemplos de solicitudes pendientes
INSERT INTO appointment_requests (patient_id, specialty_id, status, requested_date, internal_notes, created_by, created_at) 
SELECT 
  (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1),
  (SELECT id FROM specialties WHERE name = 'Cardiología' LIMIT 1),
  'pendiente',
  CURRENT_DATE + INTERVAL '3 days',
  'Solicitud vía WhatsApp - Requiere validación de autorización',
  (SELECT id FROM users LIMIT 1),
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_requests (patient_id, specialty_id, status, requested_date, internal_notes, created_by, created_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '9876543210' LIMIT 1),
  (SELECT id FROM specialties WHERE name = 'Dermatología' LIMIT 1),
  'en_revision',
  CURRENT_DATE + INTERVAL '5 days',
  'Revisando disponibilidad de especialista',
  (SELECT id FROM users LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '2 days'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_requests (patient_id, specialty_id, status, requested_date, internal_notes, created_by, created_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1),
  (SELECT id FROM specialties WHERE name = 'Gastroenterología' LIMIT 1),
  'confirmada',
  CURRENT_DATE + INTERVAL '7 days',
  'Cita confirmada - Se envió confirmación al paciente',
  (SELECT id FROM users LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '5 days'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_requests (patient_id, specialty_id, status, requested_date, internal_notes, created_by, created_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '2222222222' LIMIT 1),
  (SELECT id FROM specialties WHERE name = 'Neurología' LIMIT 1),
  'pendiente',
  CURRENT_DATE + INTERVAL '4 days',
  'Solicitud urgente - Requiere atención prioritaria',
  (SELECT id FROM users LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '1 days'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_requests (patient_id, specialty_id, status, requested_date, internal_notes, created_by, created_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '3333333333' LIMIT 1),
  (SELECT id FROM specialties WHERE name = 'Pediatría' LIMIT 1),
  'cancelada',
  CURRENT_DATE + INTERVAL '2 days',
  'Paciente canceló la solicitud',
  (SELECT id FROM users LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '10 days'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. CONVERSACIONES DE WHATSAPP DE EJEMPLO
-- =====================================================
INSERT INTO conversations (patient_id, status, whatsapp_number, appointment_request_id, last_message_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1),
  'nueva',
  '+573001234567',
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1) LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '30 minutes'
WHERE EXISTS (SELECT 1 FROM patients LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO conversations (patient_id, status, whatsapp_number, appointment_request_id, last_message_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '9876543210' LIMIT 1),
  'en_atencion',
  '+573009876543',
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '9876543210' LIMIT 1) LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM patients LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO conversations (patient_id, status, whatsapp_number, appointment_request_id, last_message_at)
SELECT
  (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1),
  'cerrada',
  '+573115555555',
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1) LIMIT 1),
  CURRENT_TIMESTAMP - INTERVAL '1 days'
WHERE EXISTS (SELECT 1 FROM patients LIMIT 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. MENSAJES DE CONVERSACIONES DE EJEMPLO
-- =====================================================
-- Conversación 1
INSERT INTO conversation_messages (conversation_id, sender_type, message_text)
SELECT
  (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1) LIMIT 1),
  'patient',
  'Hola, necesito agendar una cita con cardiología urgente'
WHERE EXISTS (SELECT 1 FROM conversations LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO conversation_messages (conversation_id, sender_type, sender_id, message_text)
SELECT
  (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1) LIMIT 1),
  'staff',
  (SELECT id FROM users LIMIT 1),
  'Hola Juan, podemos ayudarte. Me gustaría confirmar algunos datos. ¿Cuál es tu número de documento?'
WHERE EXISTS (SELECT 1 FROM conversations LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO conversation_messages (conversation_id, sender_type, message_text)
SELECT
  (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1234567890' LIMIT 1) LIMIT 1),
  'patient',
  'Mi documento es 1234567890, estoy asegurado en Aseguradora Salud Plus'
WHERE EXISTS (SELECT 1 FROM conversations LIMIT 1)
ON CONFLICT DO NOTHING;

-- Conversación 2
INSERT INTO conversation_messages (conversation_id, sender_type, message_text)
SELECT
  (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE document_number = '9876543210' LIMIT 1) LIMIT 1),
  'patient',
  'Buenos días, tengo manchas en la piel y quisiera consultar con un dermatólogo'
WHERE EXISTS (SELECT 1 FROM conversations LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO conversation_messages (conversation_id, sender_type, sender_id, message_text)
SELECT
  (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE document_number = '9876543210' LIMIT 1) LIMIT 1),
  'staff',
  (SELECT id FROM users LIMIT 1),
  'Hola María, te ayudaremos a conseguir una cita. ¿Desde cuándo tienes ese problema?'
WHERE EXISTS (SELECT 1 FROM conversations LIMIT 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. HISTORIAL DE SOLICITUDES DE EJEMPLO
-- =====================================================
INSERT INTO appointment_request_history (appointment_request_id, action, old_status, new_status, notes, created_by)
SELECT
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1) LIMIT 1),
  'Cita creada',
  NULL,
  'pendiente',
  'Solicitud inicial desde WhatsApp',
  (SELECT id FROM users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM appointment_requests LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_request_history (appointment_request_id, action, old_status, new_status, notes, created_by)
SELECT
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1) LIMIT 1),
  'Cambio de estado',
  'pendiente',
  'en_revision',
  'Se validó información del paciente',
  (SELECT id FROM users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM appointment_requests LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO appointment_request_history (appointment_request_id, action, old_status, new_status, notes, created_by)
SELECT
  (SELECT id FROM appointment_requests WHERE patient_id = (SELECT id FROM patients WHERE document_number = '1111111111' LIMIT 1) LIMIT 1),
  'Cambio de estado',
  'en_revision',
  'confirmada',
  'Cita confirmada - Se tiene disponibilidad',
  (SELECT id FROM users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM appointment_requests LIMIT 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DEL SCRIPT DE DATOS
-- =====================================================
