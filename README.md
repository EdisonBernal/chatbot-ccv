# CRM de Citas Médicas - Clínica Crear Visión

Sistema completo de gestión de citas médicas con integración WhatsApp, control de roles, y gestión de solicitudes de citas.

## Características Principales

### 1. Dashboard
- Métricas en tiempo real (solicitudes pendientes, confirmadas, etc.)
- Últimas solicitudes y conversaciones
- Panel de control personalizado

### 2. Módulo de Pacientes
- Tabla completa de pacientes con búsqueda
- Formulario para crear/editar pacientes
- Campos: nombre completo, teléfono, email, documento, fecha nacimiento, EPS, alergias, etc.
- Eliminación de pacientes con confirmación

### 3. Módulo de Solicitudes de Citas
- Tabla de solicitudes con estados: Pendiente, En revisión, Confirmada, Cancelada
- Formulario para crear nuevas solicitudes
- Cambio de estado con historial automático
- Página de detalle con historial completo de cambios
- Filtrado por estado

### 4. Kanban Board
- Vista tipo Kanban con columnas por estado
- Drag & drop para cambiar estado
- Vista rápida de solicitudes

### 5. Módulo de Conversaciones WhatsApp
- Integración con Twilio WhatsApp (bidireccional)
- **Interfaz tipo WhatsApp**: Lista de conversaciones a la izquierda, chat a la derecha
- **Indicador de mensajes nuevos**: Punto verde para conversaciones con mensajes sin leer
- Vista de chat con historial de mensajes
- Envío de respuestas automáticas con sincronización a WhatsApp
- Vinculación de conversaciones a solicitudes de citas
- Webhook automático para recibir mensajes de Twilio

### 6. Módulo de Administración
- Gestión de especialidades médicas
- Gestión de aseguradoras (EPS)
- Gestión de usuarios y permisos (Admin/Recepción)

## Stack Tecnológico

- **Frontend**: Next.js 16, React 19, TypeScript
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **UI**: shadcn/ui, Tailwind CSS
- **Integración**: Twilio WhatsApp API
- **Íconos**: Lucide React

## Instalación

1. **Instalar dependencias**:
```bash
pnpm install
```

2. **Ejecutar migraciones de base de datos**:
```bash
# Ejecutar los scripts SQL en tu Supabase:
# 1. scripts/01-init-database.sql (crear tablas)
# 2. scripts/02-seed-data.sql (datos de ejemplo)
```

3. **Configurar variables de entorno** (`.env.local`):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Twilio WhatsApp (ver TWILIO_SETUP.md para configuración completa)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890
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
- id (UUID)
- email
- full_name
- role (admin/recepcion)
- is_active

**patients**
- id (UUID)
- full_name
- phone_number
- email
- document_type
- document_number
- date_of_birth
- eps_id (FK)
- medical_history
- allergies

**appointment_requests**
- id (UUID)
- patient_id (FK)
- specialty_id (FK)
- requested_date
- status (pendiente/en_revision/confirmada/cancelada)
- reason
- notes
- created_by (FK users)

**conversations**
- id (UUID)
- patient_id (FK)
- whatsapp_number
- status (nueva/en_atencion/resuelta/pendiente)
- appointment_request_id (FK)
- last_message
- last_message_at

**conversation_messages**
- id (UUID)
- conversation_id (FK)
- sender_type (patient/staff)
- message_text
- sender_id (FK users)

## Políticas de Seguridad RLS

Todas las tablas tienen habilitadas políticas RLS:
- **Usuarios**: Admin ve todo, users solo ven su perfil
- **Pacientes**: Todos los autenticados pueden ver/crear, solo admin puede eliminar
- **Solicitudes**: Acceso basado en especialidad y usuario
- **Conversaciones**: Acceso a conversaciones propias/asignadas

## Endpoints API

### Pacientes
- `GET /api/patients` - Listar pacientes
- `POST /api/patients` - Crear paciente
- `GET /api/patients/[id]` - Obtener paciente
- `PUT /api/patients/[id]` - Actualizar paciente
- `DELETE /api/patients/[id]` - Eliminar paciente

### Solicitudes de Citas
- `GET /api/appointments` - Listar solicitudes
- `POST /api/appointments` - Crear solicitud
- `GET /api/appointments/[id]` - Obtener solicitud
- `PUT /api/appointments/[id]` - Actualizar solicitud
- `PUT /api/appointments/[id]/status` - Cambiar estado

### Conversaciones
- `GET /api/conversations` - Listar conversaciones
- `POST /api/conversations` - Crear conversación
- `GET /api/conversations/[id]` - Obtener conversación
- `GET /api/conversations/[id]/messages` - Obtener mensajes de una conversación
- `POST /api/conversations/[id]/reply` - Enviar respuesta (envía a Twilio y guarda localmente)
- `POST /api/conversations/[id]/view` - Marcar conversación como vista (actualiza `last_view_at`)
- `POST /api/webhooks/twilio` - Webhook Twilio (recibe mensajes entrantes)
  - **Configurar URL en**: https://console.twilio.com → Messaging → WhatsApp → Senders → [Your Number] → Webhook Settings
  - **URL**: `https://tu-dominio.com/api/webhooks/twilio`

### Administración
- `GET /api/specialties` - Listar especialidades
- `POST /api/specialties` - Crear especialidad
- `GET /api/eps` - Listar aseguradoras
- `POST /api/eps` - Crear aseguradora
- `GET /api/users` - Listar usuarios

## Configuración de Twilio WhatsApp

1. Acceder a https://console.twilio.com
2. Copiar Account SID y Auth Token
3. En WhatsApp Sandbox, configurar el URL de webhook entrante:
   ```
   https://tu-dominio.com/api/webhooks/twilio
   ```
4. Guardar en variables de entorno

## Flujo de Solicitud de Cita

1. **Creación**: Recepcionista crea solicitud desde el dashboard
2. **Revisión**: El estado pasa a "en_revision"
3. **Confirmación**: Si es posible, cambia a "confirmada"
4. **Conversación**: Se puede vincular a una conversación WhatsApp
5. **Historial**: Todos los cambios se registran automáticamente

## Roles y Permisos

**Administrador**
- Acceso completo a todos los módulos
- Gestión de usuarios
- Gestión de especialidades y EPS
- Ver reportes y logs

**Recepción**
- Gestión de pacientes
- Crear y cambiar estado de solicitudes
- Atender conversaciones
- No puede acceder a administración

## Deployment

Desplegar en Vercel:

```bash
# Conectar repositorio GitHub
# Configurar variables de entorno en Vercel
# Deploy automático en cada push
```

## Mantenimiento

### Backups
- Supabase realiza backups automáticos
- Exportar datos: Herramientas > Exportar en Supabase dashboard

### Monitoreo
- Revisar logs en `/api/logs`
- Monitorear métricas del dashboard
- Revisar conversaciones sin responder

## Soporte y Bugs

Para reportar issues o solicitar features, crear un issue en el repositorio.

---

Desarrollado con ❤️ para clínicas médicas modernas
