# Changelog - Sistema de CRM de Citas Médicas

## Cambios Recientes

### Interfaz WhatsApp (Nueva)
- **Componente**: `WhatsAppConversationsClient` en `components/conversations/whatsapp-conversations-client.tsx`
- **Características**:
  - Lista de conversaciones a la izquierda (similar a WhatsApp)
  - Chat detallado a la derecha
  - Interfaz responsive: en mobile se oculta la lista al seleccionar un chat
  - Búsqueda en tiempo real en la lista de conversaciones

### Indicador de Mensajes Nuevos
- **Columna agregada**: `last_view_at` en tabla `conversations`
- **Funcionamiento**:
  - Punto verde (🟢 `Dot`) muestra cuando hay mensajes sin leer
  - `last_view_at` se actualiza cuando el usuario abre una conversación
  - `last_message_at` se actualiza cada vez que hay un nuevo mensaje
  - Si `last_message_at > last_view_at`, hay mensajes nuevos

### Integración Twilio WhatsApp Mejorada
- **Webhook Verificación**: Valida que los mensajes provengan de Twilio usando HMAC-SHA1
- **Sincronización Bidireccional**:
  - Recibe mensajes desde WhatsApp vía webhook (`POST /api/webhooks/twilio`)
  - Envía respuestas a WhatsApp desde la aplicación (`POST /api/conversations/[id]/reply`)
  - Guarda todos los mensajes localmente en Supabase

### Nuevos Endpoints API
- `GET /api/conversations/[id]/messages` - Obtener mensajes de una conversación
- `POST /api/conversations/[id]/view` - Marcar conversación como vista
- `POST /api/conversations/[id]/reply` - Enviar respuesta (envía a Twilio y guarda localmente)

### Archivos Actualizados
- `middleware.ts` - Mejora de protección de rutas
- `app/api/webhooks/twilio/route.ts` - Verificación de firma HMAC
- `app/api/conversations/[id]/reply/route.ts` - Integración completa con Twilio
- `.env.example` - Variables de Twilio correctas (sin prefijo `whatsapp:`)
- `README.md` - Documentación completa sobre nuevas características

### Nuevos Archivos
- `TWILIO_SETUP.md` - Guía paso a paso para configurar Twilio WhatsApp
- `scripts/03-migration-add-columns.sql` - Migración para agregar `last_message` y `last_view_at`
- `CHANGELOG.md` - Este archivo

### Base de Datos
**Script de Migración** (`scripts/03-migration-add-columns.sql`):
```sql
-- Agrega columnas si no existen
ALTER TABLE conversations ADD COLUMN last_message text;
ALTER TABLE conversations ADD COLUMN last_view_at timestamp with time zone;

-- Crea índices para optimizar búsquedas de mensajes sin leer
CREATE INDEX idx_conversations_unread
  ON conversations(last_message_at, last_view_at)
  WHERE last_message_at IS NOT NULL AND (last_view_at IS NULL OR last_message_at > last_view_at);
```

## Cómo Usar la Nueva Interfaz WhatsApp

1. **Acceder a Conversaciones**:
   - Ve a `/dashboard/conversations`
   - Verás la lista de chats a la izquierda

2. **Identificar Mensajes Nuevos**:
   - Busca un **punto verde** (🟢) junto a la conversación
   - Esto indica que hay mensajes sin leer

3. **Leer un Chat**:
   - Haz clic en una conversación en la lista
   - El chat se abrirá a la derecha
   - El punto verde desaparecerá automáticamente (se marca como visto)

4. **Responder**:
   - Escribe tu mensaje en el campo de texto
   - Haz clic en el botón Enviar (o Ctrl+Enter)
   - El mensaje se enviará a WhatsApp automáticamente

## Configuración de Twilio

**Variables de Entorno Requeridas**:
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890
```

**Importante**: 
- `TWILIO_WHATSAPP_NUMBER` debe ser solo el número, SIN el prefijo `whatsapp:`
- El webhook se configura automáticamente en `https://tu-dominio.com/api/webhooks/twilio`

Ver [TWILIO_SETUP.md](./TWILIO_SETUP.md) para instrucciones completas.

## Orden de Instalación

1. Crear base de datos en Supabase
2. Ejecutar `scripts/01-init-database.sql` (crear tablas)
3. Ejecutar `scripts/02-seed-data.sql` (datos de ejemplo)
4. Ejecutar `scripts/03-migration-add-columns.sql` (agregar nuevas columnas)
5. Configurar variables de entorno
6. Configurar webhook de Twilio

## Cambios de Estructura de Datos

### Tabla `conversations`
```sql
-- Columnas nuevas:
ALTER TABLE conversations ADD COLUMN last_message text;
ALTER TABLE conversations ADD COLUMN last_view_at timestamp with time zone;

-- Descripción:
-- last_message: Texto del último mensaje recibido
-- last_view_at: Timestamp cuando un staff último vio esta conversación
```

### Índices Nuevos
```sql
CREATE INDEX idx_conversations_unread
  ON conversations(last_message_at, last_view_at)
  WHERE last_message_at IS NOT NULL AND (last_view_at IS NULL OR last_message_at > last_view_at);
```

## Funcionalidades

✅ Interfaz tipo WhatsApp
✅ Indicador de mensajes nuevos (punto verde)
✅ Sincronización bidireccional con Twilio
✅ Búsqueda en conversaciones
✅ Responsive design
✅ Verificación de seguridad (HMAC)
✅ Guardado automático de mensajes
✅ Historial completo de conversaciones

## Próximos Pasos Opcionales

- [ ] Agregar reacción de emojis a mensajes
- [ ] Implementar notificaciones push
- [ ] Agregar búsqueda dentro de un chat
- [ ] Exportar conversaciones a PDF
- [ ] Integración con más canales (Telegram, etc.)
- [ ] Soporte para archivos/imágenes en chats

## Soporte y Documentación

- **README.md** - Documentación general del proyecto
- **TWILIO_SETUP.md** - Configuración de Twilio WhatsApp
- **GETTING_STARTED.md** - Guía de inicio rápido
- **API Docs** - Ver sección de endpoints en README.md
