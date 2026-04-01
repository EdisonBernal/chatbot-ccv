# CRM de Citas Médicas - Clínica Crear Visión

Sistema completo de gestión de citas médicas con integración WhatsApp bidireccional, chatbot automatizado, control de roles, y gestión de solicitudes de citas.

## Características Principales

### 1. Dashboard
- Métricas en tiempo real: solicitudes pendientes, en revisión, confirmadas, canceladas
- Total de solicitudes del día
- Conversaciones nuevas y en atención
- Últimas solicitudes y conversaciones recientes
- Enlaces rápidos a módulos principales

### 2. Módulo de Pacientes
- Tabla con búsqueda por nombre, teléfono o documento
- Filtro por EPS (aseguradora)
- Formulario para crear/editar pacientes
- Campos: nombre completo, teléfono, email, tipo y número de documento, fecha de nacimiento, EPS
- Eliminación con confirmación
- Normalización automática de números telefónicos

### 3. Módulo de Solicitudes de Citas
- Tabla de solicitudes con estados: Pendiente, En revisión, Confirmada, Cancelada
- Formulario para crear nuevas solicitudes
- Cambio de estado con historial automático
- Página de detalle con historial completo de cambios
- Filtrado por estado
- Edición inline de estado

### 4. Kanban Board
- Vista tipo Kanban con columnas por estado (Pendiente → En Revisión → Confirmada / Cancelada)
- Drag & drop para cambiar estado
- Contador de solicitudes por columna
- Auto-actualización de estado al soltar

### 5. Módulo de Conversaciones WhatsApp
- Integración bidireccional con Twilio Conversations API
- **Interfaz tipo WhatsApp**: lista de conversaciones a la izquierda, chat a la derecha
- **Indicador de mensajes nuevos**: punto verde para conversaciones con mensajes sin leer
- **Estado de entrega de mensajes**: queued → sent → delivered → read (ticks visuales)
- **Confirmaciones de lectura (blue checks)** vía Read Horizon de Twilio
- **Broadcasting en tiempo real** con Supabase Realtime
- Vista responsiva (lista se oculta en móvil cuando el chat está abierto)
- Vinculación de conversaciones a solicitudes de citas
- Webhook con validación HMAC-SHA1 para recibir mensajes

### 6. Chatbot Automatizado
- Motor de chatbot configurable con flujos paso a paso
- **Tipos de trigger**: message_received, keyword, has_pending_appointment, new_patient, after_delay
- **Tipos de acción**: send_message, create_appointment_request, send_reminder, collect_info, redirect_to_agent, update_conversation_status, send_confirmation, schedule_step
- Contexto de usuario persistente por conversación
- Progresión automática de pasos
- Mensaje de fallback configurable
- Logging de ejecución para debugging
- Panel de administración con preview del chatbot

### 7. Módulo de Administración
- Gestión de especialidades médicas (CRUD, activar/desactivar)
- Gestión de aseguradoras EPS (CRUD, código opcional)
- Gestión de usuarios y permisos (Admin / Recepción)
- **Configuración de chatbot**: flujos, pasos, acciones, preview

## Stack Tecnológico

- **Framework**: Next.js 16.2, React 19, TypeScript
- **Base de Datos**: Supabase (PostgreSQL) con RLS
- **Autenticación**: Supabase Auth + SSR middleware
- **UI**: shadcn/ui, Radix UI, Tailwind CSS 4
- **Chat en tiempo real**: Twilio Conversations SDK (@twilio/conversations 3.x)
- **Formularios**: React Hook Form + Zod
- **Gráficas**: Recharts
- **Utilidades**: date-fns, clsx, class-variance-authority, tailwind-merge
- **Íconos**: Lucide React
- **Analytics**: Vercel Analytics
- **Gestión de paquetes**: pnpm

## Instalación

1. **Instalar dependencias**:
```bash
pnpm install
```

2. **Ejecutar migraciones de base de datos** (en orden):
```bash
# Ejecutar los scripts SQL en tu Supabase Dashboard → SQL Editor:
# 1. scripts/01-init-database.sql        → Esquema base (tablas, RLS, índices)
# 2. scripts/02-seed-data.sql            → Datos de ejemplo
# 3. scripts/03-migration-add-columns.sql → Columnas WhatsApp tracking
# 4. scripts/04-chatbot-schema.sql       → Tablas del chatbot
# 5. scripts/05-normalize-phone-unique.sql → Normalización de teléfonos
# 6. scripts/06-broadcast-conversation-messages.sql → Broadcasting en tiempo real
# 7. scripts/07-fix-chatbot-config-rls.sql → RLS chatbot_config
# 8. scripts/08-fix-chatbot-steps-rls.sql  → RLS chatbot_steps
# 9. scripts/09-chatbot-add-message-delivery-status.sql → Estado de entrega
# 10. scripts/10-conversations-api-migration.sql → Integración Twilio Conversations API
```

3. **Configurar variables de entorno** (`.env.local`):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio (ver TWILIO_SETUP.md para configuración completa)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_API_KEY=SKxxxxxxxxxx
TWILIO_API_SECRET=your-api-secret
TWILIO_WHATSAPP_NUMBER=+1234567890
CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# Desarrollo (opcional)
TWILIO_SKIP_SIGNATURE=1
```

4. **Iniciar servidor de desarrollo**:
```bash
pnpm dev
```

5. **Configurar Twilio WhatsApp**:
Ver [TWILIO_SETUP.md](./TWILIO_SETUP.md) para instrucciones detalladas

## Estructura de Base de Datos

### Tablas Principales

**users**
- id (UUID), auth_id, email, full_name, role (admin/recepcion), is_active, timestamps

**patients**
- id (UUID), full_name, phone_number, phone_number_normalized, email, document_type, document_number, date_of_birth, eps_id (FK), timestamps

**specialties**
- id (UUID), name, description, is_active, timestamps

**eps**
- id (UUID), name, description, code, is_active, timestamps

**appointment_requests**
- id (UUID), patient_id (FK), specialty_id (FK), requested_date, status (pendiente/en_revision/confirmada/cancelada), internal_notes, created_by (FK users), timestamps

**appointment_request_history**
- id (UUID), appointment_request_id (FK), action, old_status, new_status, notes, created_by (FK users), timestamps

**conversations**
- id (UUID), patient_id (FK), whatsapp_number, whatsapp_number_normalized, conversation_sid (Twilio SID), status (nueva/en_atencion/cerrada), appointment_request_id (FK), last_message, last_message_at, last_view_at, timestamps

**conversation_messages**
- id (UUID), conversation_id (FK), sender_type (patient/staff), message_text, sender_id (FK users), twilio_sid, message_index, delivery_status (queued/sent/delivered/read), timestamps

**chatbot_config**
- id (UUID), name, description, welcome_message, fallback_message, escalation_message, max_retries, is_active, timestamps

**chatbot_steps**
- id (UUID), config_id (FK), step_order, name, trigger_type, trigger_value, message_template, timestamps

**chatbot_step_actions**
- id (UUID), step_id (FK), action_type, action_config (JSONB), action_order, timestamps

**chatbot_context**
- id (UUID), conversation_id (FK), variable_name, variable_value, timestamps

**chatbot_execution_logs**
- id (UUID), conversation_id, step_id, action_type, status, error_message, timestamps

## Políticas de Seguridad RLS

Todas las tablas tienen habilitadas políticas RLS:
- **Usuarios**: Admin ve todo, usuarios solo ven su perfil
- **Pacientes**: Todos los autenticados pueden ver/crear, solo admin puede eliminar
- **Solicitudes**: Acceso basado en especialidad y usuario
- **Conversaciones**: Acceso a conversaciones propias/asignadas
- **Chatbot**: Solo admin puede crear/modificar configuraciones

## Endpoints API

### Pacientes
- `GET /api/patients` - Listar pacientes (búsqueda por nombre, teléfono, documento)
- `POST /api/patients` - Crear paciente
- `GET /api/patients/[id]` - Obtener paciente con EPS
- `PUT /api/patients/[id]` - Actualizar paciente
- `DELETE /api/patients/[id]` - Eliminar paciente

### Solicitudes de Citas
- `GET /api/appointments` - Listar solicitudes (filtro por estado)
- `POST /api/appointments` - Crear solicitud (auto-estado: pendiente)
- `GET /api/appointments/[id]` - Obtener solicitud con relaciones completas
- `PUT /api/appointments/[id]` - Actualizar solicitud
- `DELETE /api/appointments/[id]` - Eliminar solicitud
- `PATCH /api/appointments/[id]/status` - Cambiar estado con registro de historial

### Conversaciones
- `GET /api/conversations` - Listar conversaciones con conteo de no leídos
- `POST /api/conversations` - Crear conversación
- `PATCH /api/conversations/[id]` - Actualizar conversación
- `GET /api/conversations/[id]/messages` - Obtener mensajes ordenados
- `POST /api/conversations/[id]/reply` - Enviar respuesta (Twilio + Supabase)
- `POST /api/conversations/[id]/view` - Marcar conversación como vista (actualiza `last_view_at`)
- `POST /api/conversations/[id]/read` - Marcar como leído (Read Horizon → blue checks)

### Chatbot
- `GET /api/chatbot` - Listar configuraciones del chatbot
- `POST /api/chatbot` - Crear configuración (requiere rol admin)
- `GET /api/chatbot/[id]` - Obtener configuración con pasos y acciones
- `PUT /api/chatbot/[id]` - Actualizar configuración
- `PATCH /api/chatbot/[id]` - Actualizar parcialmente
- `DELETE /api/chatbot/[id]` - Eliminar configuración
- `PUT /api/chatbot/steps/[stepId]` - Actualizar paso
- `DELETE /api/chatbot/steps/[stepId]` - Eliminar paso
- `PUT /api/chatbot/actions/[actionId]` - Actualizar acción
- `DELETE /api/chatbot/actions/[actionId]` - Eliminar acción

### Twilio
- `POST /api/twilio/token` - Generar Access Token (ChatGrant, TTL: 1h)

### Webhooks
- `POST /api/webhooks/twilio` - Webhook Twilio Conversations
  - Validación de firma HMAC-SHA1
  - Eventos soportados: `onMessageAdded`, `onDeliveryUpdated`
  - Procesamiento automático del chatbot
  - Soporte legacy para Messaging API
  - **Configurar en**: Twilio Console → Conversations → Service → Webhooks
  - **Post-Event URL**: `https://tu-dominio.com/api/webhooks/twilio`

### Administración
- `GET /api/specialties` - Listar especialidades (opción `onlyActive`)
- `POST /api/specialties` - Crear especialidad
- `GET /api/eps` - Listar aseguradoras (opción `onlyActive`)
- `POST /api/eps` - Crear aseguradora
- `GET /api/users` - Listar usuarios

### Debug (solo desarrollo)
- `/api/debug/broadcast-test` - Test de broadcasting
- `/api/debug/broadcast-update` - Test de actualizaciones broadcast
- `/api/debug/conversation-last-message` - Debug de último mensaje
- `/api/debug/realtime-test` - Test de Supabase Realtime

## Integración Twilio

### Arquitectura

El sistema usa **Twilio Conversations API** para mensajería bidireccional con WhatsApp:

1. **Token Service**: Genera JWT con ChatGrant para el SDK frontend
2. **Webhook Handler**: Recibe y procesa eventos de Twilio con validación de firma
3. **Frontend Hook** (`useTwilioConversations`): Gestiona conexión SDK, Read Horizon, y estados de entrega
4. **Chatbot Engine**: Procesa mensajes entrantes y ejecuta flujos automatizados

### Configuración en Twilio Console

1. Crear un Conversations Service
2. Habilitar eventos: `onMessageAdded`, `onDeliveryUpdated`
3. Configurar Post-Event Webhook URL: `https://tu-dominio.com/api/webhooks/twilio`
4. Habilitar Read Status para confirmaciones de lectura

Ver [TWILIO_SETUP.md](./TWILIO_SETUP.md) para la guía completa.

## Flujo de Solicitud de Cita

1. **Creación**: Recepcionista crea solicitud desde el dashboard o el chatbot la crea automáticamente
2. **Revisión**: El estado pasa a "en_revision"
3. **Confirmación**: Si es posible, cambia a "confirmada"
4. **Conversación**: Se puede vincular a una conversación WhatsApp
5. **Historial**: Todos los cambios de estado se registran automáticamente en `appointment_request_history`

## Autenticación y Middleware

- Protección de rutas `/dashboard` y `/admin` mediante middleware de Next.js
- Validación de sesión con `supabase.auth.getUser()` en cada request
- Redirección automática a `/auth/login` si no hay sesión
- Ruta raíz `/` redirige a `/dashboard`

## Roles y Permisos

**Administrador**
- Acceso completo a todos los módulos
- Gestión de usuarios
- Gestión de especialidades y EPS
- Configuración del chatbot
- Ver reportes y logs

**Recepción**
- Gestión de pacientes
- Crear y cambiar estado de solicitudes
- Atender conversaciones WhatsApp
- No puede acceder a administración ni configurar chatbot

## Estructura del Proyecto

```
app/
  api/                    # Endpoints API (REST)
    appointments/         # CRUD solicitudes de citas
    chatbot/              # Configuración del chatbot
    conversations/        # Gestión de conversaciones
    debug/                # Endpoints de debug (dev only)
    eps/                  # Aseguradoras
    patients/             # CRUD pacientes
    specialties/          # Especialidades médicas
    twilio/               # Token service
    users/                # Gestión de usuarios
    webhooks/             # Webhook de Twilio
  auth/login/             # Página de login
  dashboard/              # Páginas del dashboard
    admin/                # Administración (especialidades, EPS, usuarios, chatbot)
    appointments/         # Vista de solicitudes
    conversations/        # Chat WhatsApp
    kanban/               # Vista Kanban
    patients/             # Gestión de pacientes
components/
  admin/                  # Componentes de administración
    chatbot/              # UI del chatbot (config, steps, actions, preview)
  appointments/           # Componentes de solicitudes
  conversations/          # Componentes de chat WhatsApp
  dashboard/              # Métricas y resúmenes
  kanban/                 # Tablero Kanban
  layout/                 # Sidebar y layout
  patients/               # Componentes de pacientes
  ui/                     # Componentes shadcn/ui
hooks/                    # Custom hooks (mobile, query, toast, twilio)
lib/
  chatbot-engine.ts       # Motor del chatbot
  types.ts                # Interfaces y enums TypeScript
  utils.ts                # Utilidades generales
  services/               # Capa de servicios (Supabase queries)
  supabase/               # Configuración cliente/servidor Supabase
scripts/                  # Migraciones SQL (01-10)
```

## Deployment

Desplegar en Vercel:

1. Conectar repositorio GitHub a Vercel
2. Configurar todas las variables de entorno en Vercel Dashboard
3. Ejecutar las migraciones SQL en Supabase
4. Configurar webhook de Twilio apuntando al dominio de producción
5. Deploy automático en cada push a main

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para la guía completa.

## Mantenimiento

### Backups
- Supabase realiza backups automáticos
- Exportar datos: Herramientas > Exportar en Supabase Dashboard

### Monitoreo
- Monitorear métricas del dashboard
- Revisar conversaciones sin responder
- Consultar logs de ejecución del chatbot (`chatbot_execution_logs`)
- Verificar estados de entrega de mensajes WhatsApp

---

Desarrollado con ❤️ para clínicas médicas modernas
