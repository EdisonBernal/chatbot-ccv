# Changelog - Sistema de CRM de Citas Médicas

## Cambios Recientes

### Twilio Conversations API (Migración)
- **Migración completa** de Twilio Messaging API a **Conversations API**
- Token service con ChatGrant para SDK frontend (`POST /api/twilio/token`)
- Resolución automática de Conversation SID (crea si no existe)
- Gestión de participantes en conversaciones
- Hook `useTwilioConversations` para inicialización del SDK client-side
- Refresh automático de tokens (TTL: 1h)
- **Script**: `scripts/10-conversations-api-migration.sql`

### Estado de Entrega de Mensajes
- Tracking de delivery status: `queued → sent → delivered → read`
- Enum `message_delivery_status` en base de datos
- Ticks visuales en la UI (✓ enviado, ✓✓ entregado, ✓✓ azul leído)
- Webhook `onDeliveryUpdated` para actualizaciones automáticas
- **Script**: `scripts/09-chatbot-add-message-delivery-status.sql`

### Blue Checks (Confirmaciones de Lectura)
- Implementación de Read Horizon de Twilio
- Columna `message_index` en `conversation_messages`
- Endpoint `POST /api/conversations/[id]/read` para avanzar Read Horizon
- Blue checks visibles en WhatsApp cuando el staff lee mensajes

### Broadcasting en Tiempo Real
- Broadcasting de mensajes a clientes conectados vía Supabase Realtime
- Actualización instantánea de la UI cuando llegan nuevos mensajes
- **Script**: `scripts/06-broadcast-conversation-messages.sql`

### Normalización de Teléfonos
- Función `normalize_phone()` en PostgreSQL
- Columnas normalizadas: `phone_number_normalized`, `whatsapp_number_normalized`
- Triggers automáticos en insert/update
- Índices únicos para prevenir duplicados
- **Script**: `scripts/05-normalize-phone-unique.sql`

### Chatbot Automatizado (Nuevo Módulo)
- **Motor**: Clase `ChatbotEngine` en `lib/chatbot-engine.ts`
  - 5 tipos de triggers: message_received, keyword, has_pending_appointment, new_patient, after_delay
  - 8 tipos de acciones: send_message, create_appointment_request, send_reminder, collect_info, redirect_to_agent, update_conversation_status, send_confirmation, schedule_step
  - Variables dinámicas ({{nombre}}, {{email}}, etc.)
  - Contexto persistente por conversación
  - Logging de ejecuciones
- **Panel Admin**: 7 componentes en `components/admin/chatbot/`
  - Lista de configuraciones con toggle activo/inactivo
  - Editor de pasos con preview en tiempo real
  - Constructor de acciones sin código
  - Vista previa completa del flujo
- **API**: 6 endpoints para CRUD completo
- **BD**: 6 tablas nuevas con RLS
- **Scripts**: `scripts/04-chatbot-schema.sql`, `scripts/07-fix-chatbot-config-rls.sql`, `scripts/08-fix-chatbot-steps-rls.sql`

### Interfaz WhatsApp
- **Componente**: `WhatsAppConversationsClient` en `components/conversations/whatsapp-conversations-client.tsx`
- **Características**:
  - Lista de conversaciones a la izquierda (similar a WhatsApp)
  - Chat detallado a la derecha
  - Interfaz responsive: en mobile se oculta la lista al seleccionar un chat
  - Búsqueda en tiempo real en la lista de conversaciones

### Indicador de Mensajes Nuevos
- **Columna agregada**: `last_view_at` en tabla `conversations`
- **Funcionamiento**:
  - Punto verde (🟢) muestra cuando hay mensajes sin leer
  - `last_view_at` se actualiza cuando el usuario abre una conversación
  - `last_message_at` se actualiza cada vez que hay un nuevo mensaje
  - Si `last_message_at > last_view_at`, hay mensajes nuevos
- **Script**: `scripts/03-migration-add-columns.sql`

### Webhook Twilio Mejorado
- Validación de firma HMAC-SHA1
- Soporte para Conversations API events (`onMessageAdded`, `onDeliveryUpdated`)
- Procesamiento automático del chatbot al recibir mensajes
- Broadcasting de mensajes a clientes conectados
- Soporte legacy para Messaging API (backward compatibility)
- Variable `TWILIO_SKIP_SIGNATURE=1` para desarrollo

### Endpoints API Nuevos
- `GET /api/conversations/[id]/messages` - Obtener mensajes de una conversación
- `POST /api/conversations/[id]/view` - Marcar conversación como vista
- `POST /api/conversations/[id]/reply` - Enviar respuesta (Twilio + Supabase)
- `POST /api/conversations/[id]/read` - Marcar como leído (Read Horizon)
- `PATCH /api/conversations/[id]` - Actualizar conversación
- `POST /api/twilio/token` - Generar Access Token
- `GET/POST /api/chatbot` - CRUD configuraciones
- `GET/PUT/PATCH/DELETE /api/chatbot/[id]` - Gestión de configuración
- `PUT/DELETE /api/chatbot/steps/[stepId]` - Gestión de pasos
- `PUT/DELETE /api/chatbot/actions/[actionId]` - Gestión de acciones
- `PATCH /api/appointments/[id]/status` - Cambiar estado de solicitud

### Archivos Nuevos
- `lib/chatbot-engine.ts` - Motor del chatbot
- `lib/services/chatbot.ts` - Servicio del chatbot
- `hooks/use-twilio-conversations.ts` - Hook del SDK Twilio
- `hooks/use-query.ts` - Hook para fetching de datos
- `components/admin/chatbot/` - 7 componentes del panel de chatbot
- `app/dashboard/admin/chatbot/` - Páginas del chatbot
- `app/api/chatbot/` - Endpoints del chatbot
- `app/api/twilio/token/` - Token service
- `app/api/conversations/[id]/read/` - Read Horizon
- `scripts/04-chatbot-schema.sql` → `scripts/10-conversations-api-migration.sql`
- `CHATBOT_GUIDE.md` - Guía completa del chatbot
- `CHATBOT_IMPLEMENTATION.md` - Documentación técnica del chatbot
- `CHATBOT_COMPLETE_SUMMARY.md` - Resumen visual del chatbot

### Base de Datos - Migraciones
| Script | Descripción |
|--------|-------------|
| `03-migration-add-columns.sql` | `last_message`, `last_view_at`, índice de no leídos |
| `04-chatbot-schema.sql` | 6 tablas del chatbot con RLS y triggers |
| `05-normalize-phone-unique.sql` | Función `normalize_phone()`, columnas y triggers |
| `06-broadcast-conversation-messages.sql` | Broadcasting Supabase Realtime |
| `07-fix-chatbot-config-rls.sql` | Ajustes RLS para chatbot_config |
| `08-fix-chatbot-steps-rls.sql` | Ajustes RLS para chatbot_steps |
| `09-chatbot-add-message-delivery-status.sql` | Enum `message_delivery_status` |
| `10-conversations-api-migration.sql` | `conversation_sid`, `message_index` |

### Variables de Entorno Nuevas
```env
SUPABASE_SERVICE_ROLE_KEY=...     # Para operaciones admin del chatbot
TWILIO_API_KEY=SKxxxxxxxxxx       # Para generar Access Tokens
TWILIO_API_SECRET=...             # Para generar Access Tokens
CONVERSATIONS_SERVICE_SID=IS...   # Conversations Service de Twilio
NEXT_PUBLIC_APP_URL=...           # URL de la aplicación
TWILIO_SKIP_SIGNATURE=1           # Solo desarrollo - omitir validación
```

## Orden de Instalación

1. Crear base de datos en Supabase
2. Ejecutar scripts SQL en orden (01 → 10) en Supabase SQL Editor
3. Configurar todas las variables de entorno
4. Crear Conversations Service en Twilio Console
5. Configurar Post-Event Webhook en Twilio
6. Habilitar eventos: `onMessageAdded`, `onDeliveryUpdated`
7. Habilitar Read Status en el Conversations Service

## Funcionalidades Completas

✅ Interfaz tipo WhatsApp
✅ Indicador de mensajes nuevos (punto verde)
✅ Estado de entrega de mensajes (ticks)
✅ Blue checks (confirmaciones de lectura)
✅ Sincronización bidireccional con Twilio Conversations API
✅ Broadcasting en tiempo real con Supabase Realtime
✅ Normalización de teléfonos
✅ Chatbot automatizado con motor configurable
✅ Panel admin del chatbot con preview
✅ Variables dinámicas en mensajes del chatbot
✅ Logging de ejecución del chatbot
✅ Búsqueda en conversaciones
✅ Responsive design
✅ Verificación de seguridad (HMAC-SHA1)
✅ Guardado automático de mensajes
✅ Historial completo de conversaciones

## Soporte y Documentación

- **README.md** - Documentación general del proyecto
- **TWILIO_SETUP.md** - Configuración de Twilio Conversations API
- **CHATBOT_GUIDE.md** - Guía completa del chatbot
- **CHATBOT_IMPLEMENTATION.md** - Documentación técnica del chatbot
- **CHATBOT_COMPLETE_SUMMARY.md** - Resumen visual del chatbot
- **GETTING_STARTED.md** - Guía de inicio
- **DEPLOYMENT.md** - Guía de deployment a Vercel
- **FEATURES.md** - Características del sistema
- **DOCS_INDEX.md** - Índice de toda la documentación
