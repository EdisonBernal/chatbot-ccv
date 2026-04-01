# CRM de Citas Médicas - Guía de Configuración

Este proyecto es un CRM completo para gestionar citas médicas, pacientes, especialidades, chatbot automatizado y conversaciones por WhatsApp, construido con Next.js 16, React 19, Supabase y TypeScript.

## Estructura del Proyecto

### Base de Datos (`/scripts`)
- **01-init-database.sql** - Esquema base: tablas, índices, triggers y políticas RLS
- **02-seed-data.sql** - Datos de ejemplo para pruebas
- **03-migration-add-columns.sql** - Columnas de tracking WhatsApp (`last_message_at`, `last_view_at`)
- **04-chatbot-schema.sql** - Tablas del chatbot (config, steps, actions, context, logs)
- **05-normalize-phone-unique.sql** - Normalización de teléfonos con triggers automáticos
- **06-broadcast-conversation-messages.sql** - Broadcasting en tiempo real con Supabase Realtime
- **07-fix-chatbot-config-rls.sql** - Ajustes RLS para chatbot_config
- **08-fix-chatbot-steps-rls.sql** - Ajustes RLS para chatbot_steps
- **09-chatbot-add-message-delivery-status.sql** - Enum de estado de entrega de mensajes
- **10-conversations-api-migration.sql** - Integración Twilio Conversations API (`conversation_sid`, `message_index`)

### Servicios (`/lib/services`)
- **specialties.ts** - Gestión de especialidades médicas
- **patients.ts** - Gestión de pacientes (con búsqueda fuzzy)
- **appointments.ts** - Gestión de solicitudes de citas (con historial automático)
- **eps.ts** - Gestión de aseguradoras (EPS)
- **conversations.ts** - Gestión de conversaciones WhatsApp (Twilio Conversations API, Read Horizon, delivery status)
- **chatbot.ts** - Gestión de configuraciones, pasos, acciones y contexto del chatbot
- **users.ts** - Gestión de usuarios y métricas del dashboard

### Motor del Chatbot (`/lib`)
- **chatbot-engine.ts** - Clase `ChatbotEngine` con procesamiento de mensajes, verificación de triggers, ejecución de acciones y logging

### API Routes (`/app/api`)

#### Pacientes
- **GET/POST /api/patients** - Listar (búsqueda por nombre/teléfono/documento) y crear
- **GET/PUT/DELETE /api/patients/[id]** - CRUD individual con relación EPS

#### Solicitudes de Citas
- **GET/POST /api/appointments** - Listar (filtro por estado) y crear (auto-estado: pendiente)
- **GET/PUT/DELETE /api/appointments/[id]** - CRUD individual con relaciones completas
- **PATCH /api/appointments/[id]/status** - Cambiar estado con registro de historial

#### Conversaciones
- **GET/POST /api/conversations** - Listar (con conteo de no leídos) y crear
- **PATCH /api/conversations/[id]** - Actualizar conversación
- **GET /api/conversations/[id]/messages** - Mensajes ordenados
- **POST /api/conversations/[id]/reply** - Enviar respuesta (Twilio + Supabase)
- **POST /api/conversations/[id]/view** - Marcar como vista
- **POST /api/conversations/[id]/read** - Read Horizon (blue checks)

#### Chatbot
- **GET/POST /api/chatbot** - Listar y crear configuraciones
- **GET/PUT/PATCH/DELETE /api/chatbot/[id]** - CRUD de configuración con pasos y acciones
- **PUT/DELETE /api/chatbot/steps/[stepId]** - Gestión de pasos
- **PUT/DELETE /api/chatbot/actions/[actionId]** - Gestión de acciones

#### Twilio
- **POST /api/twilio/token** - Generar Access Token (ChatGrant, TTL: 1h)

#### Webhooks
- **POST /api/webhooks/twilio** - Webhook Twilio Conversations (HMAC-SHA1, onMessageAdded, onDeliveryUpdated, procesamiento de chatbot)

#### Administración
- **GET/POST /api/specialties** - Especialidades (opción `onlyActive`)
- **GET/POST /api/eps** - Aseguradoras (opción `onlyActive`)
- **GET /api/users** - Usuarios

### Componentes (`/components`)
- **conversations/** - Interfaz WhatsApp (lista + chat), detalle de conversación
- **patients/** - Tabla y formulario de pacientes
- **appointments/** - Tabla, formulario y detalle de solicitudes
- **kanban/** - Tablero Kanban con drag & drop
- **admin/** - Gestión de especialidades, EPS, usuarios
- **admin/chatbot/** - Panel completo de configuración del chatbot (lista, editor, diálogos, preview)
- **dashboard/** - Métricas, solicitudes recientes, conversaciones recientes
- **layout/** - Sidebar de navegación
- **ui/** - Componentes shadcn/ui

### Páginas (`/app/dashboard`)
- **/dashboard** - Panel principal con métricas
- **/dashboard/patients** - Gestión de pacientes
- **/dashboard/appointments** - Solicitudes de citas
- **/dashboard/kanban** - Tablero Kanban visual
- **/dashboard/conversations** - Chat WhatsApp con UI bidireccional
- **/dashboard/admin/specialties** - Administración de especialidades
- **/dashboard/admin/eps** - Administración de aseguradoras
- **/dashboard/admin/users** - Administración de usuarios
- **/dashboard/admin/chatbot** - Configuración del chatbot

## Configuración Inicial

### 1. Supabase Integration
La integración con Supabase requiere las siguientes variables de entorno:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (necesario para operaciones admin del chatbot)

### 2. Ejecutar Migraciones de Base de Datos

En tu dashboard de Supabase:
1. Ve a la sección "SQL Editor"
2. Ejecuta los 10 scripts en orden (01 → 10) desde la carpeta `/scripts/`

### 3. Twilio Conversations API
El sistema usa Twilio Conversations API (no la Messaging API legacy):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`
- `TWILIO_WHATSAPP_NUMBER`
- `CONVERSATIONS_SERVICE_SID`
- `NEXT_PUBLIC_APP_URL`

### 4. Autenticación

El proyecto incluye soporte completo para autenticación con Supabase. Las políticas RLS están configuradas para:
- **Usuarios admin**: Acceso completo a todos los datos y configuración del chatbot
- **Usuarios recepción**: Acceso a pacientes, citas y conversaciones
- **Chatbot**: Solo admin puede crear/modificar configuraciones
- **Logs de actividad**: Solo accesible para administradores

## Cómo Usar

### Acceder al Dashboard
```
/dashboard
```

### Crear un Paciente (API)
```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "full_name": "Juan Pérez",
    "phone_number": "+573001234567",
    "email": "juan@example.com",
    "document_type": "CC",
    "document_number": "12345678",
    "eps_id": "uuid-de-la-eps"
  }'
```

### Crear una Solicitud de Cita (API)
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "patient_id": "uuid-del-paciente",
    "specialty_id": "uuid-especialidad",
    "requested_date": "2026-04-15",
    "internal_notes": "Chequeo general"
  }'
```

### Obtener Especialidades
```bash
curl http://localhost:3000/api/specialties
```

## Esquema de Base de Datos

### Tablas Base
- **users** - Usuarios del sistema (admin, recepción). RLS: cada usuario solo ve su perfil, admins ven todos
- **specialties** - Especialidades médicas. RLS: todos leen, solo admins escriben
- **eps** - Aseguradoras. RLS: todos leen, solo admins escriben
- **patients** - Pacientes con teléfono normalizado. RLS: todos autenticados leen/crean/actualizan
- **appointment_requests** - Solicitudes de citas (estados: pendiente/en_revision/confirmada/cancelada). RLS: todos autenticados
- **appointment_request_history** - Auditoría de cambios de estado

### Tablas de Conversaciones
- **conversations** - Chats WhatsApp con `conversation_sid` (Twilio), `last_view_at`, estados (nueva/en_atencion/cerrada)
- **conversation_messages** - Mensajes con `delivery_status` (queued/sent/delivered/read) y `message_index`

### Tablas del Chatbot
- **chatbot_config** - Configuraciones del chatbot (nombre, mensajes, reintentos, estado)
- **chatbot_steps** - Pasos del flujo con triggers
- **chatbot_step_actions** - Acciones por paso
- **chatbot_context** - Variables de contexto persistentes por conversación
- **chatbot_execution_logs** - Auditoría de ejecuciones del chatbot

### Tablas Auxiliares
- **system_activity_logs** - Registro de auditoría del sistema. RLS: solo admins

## Políticas RLS Implementadas

1. **Autenticación**: Todos requieren estar autenticados
2. **Roles**: Admin (acceso total), Recepción (acceso limitado)
3. **Chatbot**: Solo admin puede gestionar configuraciones
4. **Auditoría**: Logs de todas las operaciones para admin
5. **Privacidad**: RLS en todas las tablas según rol

## Desarrollo

### Instalar dependencias
```bash
pnpm install
```

### Ejecutar en desarrollo
```bash
pnpm dev
```

### Variables de Entorno
Crear archivo `.env.local` con todas las variables de Supabase, Twilio y la URL de la app. Ver `.env.example` para referencia.

## Tipos TypeScript

Todos los servicios incluyen tipos completos de TypeScript (`lib/types.ts`):
- `User`, `UserRole`
- `Patient`
- `Specialty`, `EPS`
- `AppointmentRequest`, `AppointmentRequestHistory`, `AppointmentStatus`
- `Conversation`, `ConversationMessage`, `ConversationStatus`
- `MessageDeliveryStatus`, `SenderType`
- `ChatbotConfig`, `ChatbotStep`, `ChatbotStepAction`
- `ChatbotContext`, `ChatbotExecutionLog`
- `DashboardMetrics`, `SystemActivityLog`

## Seguridad

- Todas las operaciones de base de datos usan Row Level Security (RLS)
- Las contraseñas no se almacenan en texto plano (Supabase Auth)
- Las cookies de sesión son HTTP-only
- Validación en servidor (Next.js API routes)
- Protección contra SQL injection (Supabase client library)
- Validación de firma HMAC-SHA1 en webhooks de Twilio
- Middleware de protección de rutas para `/dashboard` y `/admin`
- Normalización de teléfonos para prevenir duplicados

## Soporte

Para más información:
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de shadcn/ui](https://ui.shadcn.com)
- [Twilio Conversations API](https://www.twilio.com/docs/conversations)
- [CHATBOT_GUIDE.md](./CHATBOT_GUIDE.md) - Guía completa del chatbot
- [TWILIO_SETUP.md](./TWILIO_SETUP.md) - Configuración de Twilio
