# CRM de Citas Médicas - Guía de Configuración

Este proyecto es un CRM completo para gestionar citas médicas, pacientes, especialidades y conversaciones por WhatsApp, construido con Next.js 16, Supabase y TypeScript.

## Estructura del Proyecto

### Base de Datos (`/scripts`)
- **01-init-database.sql** - Crea todas las tablas, índices, triggers y políticas RLS
- **02-seed-data.sql** - Inserta datos de ejemplo para pruebas

### Servicios (`/lib/services`)
- **specialties.ts** - Gestión de especialidades médicas
- **patients.ts** - Gestión de pacientes
- **appointments.ts** - Gestión de solicitudes de citas
- **eps.ts** - Gestión de entidades prestadoras de salud
- **conversations.ts** - Gestión de conversaciones por WhatsApp

### API Routes (`/app/api`)
- **GET/POST /api/patients** - Listar y crear pacientes
- **GET/PUT/DELETE /api/patients/[id]** - CRUD de pacientes individuales
- **GET/POST /api/appointments** - Listar y crear solicitudes de citas
- **GET/PUT/DELETE /api/appointments/[id]** - CRUD de citas individuales
- **GET /api/specialties** - Listar especialidades
- **GET /api/eps** - Listar EPS
- **GET/POST /api/conversations** - Gestión de conversaciones
- **GET/POST /api/conversations/[id]/messages** - Gestión de mensajes

### Componentes (`/components`)
- **patients-table.tsx** - Tabla de pacientes con acciones
- **appointments-table.tsx** - Tabla de citas con estados

### Páginas (`/app`)
- **/dashboard** - Panel principal con estadísticas y gestión de datos

## Configuración Inicial

### 1. Supabase Integration
La integración con Supabase está configurada automáticamente con las siguientes variables de entorno:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTGRES_URL`

### 2. Ejecutar Migraciones de Base de Datos

En tu dashboard de Supabase:
1. Ve a la sección "SQL Editor"
2. Copia y ejecuta el contenido de `/scripts/01-init-database.sql`
3. Luego ejecuta el contenido de `/scripts/02-seed-data.sql` para datos de prueba

O desde la CLI:
```bash
# Si tienes supabase CLI configurado
supabase db push
```

### 3. Autenticación

El proyecto incluye soporte completo para autenticación con Supabase. Las políticas RLS están configuradas para:
- **Usuarios admin**: Acceso completo a todos los datos
- **Usuarios recepción**: Acceso completo a pacientes y citas
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
  -d '{
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@example.com",
    "phone": "555-1234",
    "document_type": "CC",
    "document_number": "12345678"
  }'
```

### Crear una Solicitud de Cita (API)
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "uuid-del-paciente",
    "specialty_id": "uuid-especialidad",
    "requested_date": "2025-04-15",
    "preferred_time": "10:00",
    "reason": "Chequeo general",
    "status": "pending"
  }'
```

### Obtener Especialidades
```bash
curl http://localhost:3000/api/specialties
```

## Esquema de Base de Datos

### Tabla: users
- Gestión de usuarios del sistema (admin, recepción)
- RLS: Cada usuario solo puede ver su perfil, admins ven todos

### Tabla: specialties
- Especialidades médicas disponibles
- RLS: Todos autenticados pueden leer, solo admins pueden escribir

### Tabla: eps
- Entidades prestadoras de salud
- RLS: Todos autenticados pueden leer, solo admins pueden escribir

### Tabla: patients
- Información de pacientes
- RLS: Todos autenticados pueden leer/crear/actualizar

### Tabla: appointment_requests
- Solicitudes de citas médicas
- Estados: pending, confirmed, rejected, completed, cancelled
- RLS: Todos autenticados pueden leer/crear/actualizar

### Tabla: appointment_request_history
- Historial de cambios en solicitudes
- RLS: Todos autenticados pueden leer (auditoría)

### Tabla: conversations
- Conversaciones por WhatsApp con pacientes
- RLS: Todos autenticados pueden acceder

### Tabla: conversation_messages
- Mensajes de conversaciones
- RLS: Todos autenticados pueden acceder

### Tabla: system_activity_logs
- Registro de auditoría del sistema
- RLS: Solo admins pueden acceder

## Políticas RLS Implementadas

1. **Autenticación**: Todos requieren estar autenticados
2. **Roles**: Admin (acceso total), Recepción (acceso limitado)
3. **Auditoría**: Logs de todas las operaciones para admin
4. **Privacidad**: RLS en todas las tablas según rol

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
Las variables de Supabase se configuran automáticamente. Puedes verificarlas en Settings > Vars.

## Tipos TypeScript

Todos los servicios incluyen tipos completos de TypeScript:
- `Patient`
- `Specialty`
- `EPS`
- `AppointmentRequest`
- `Conversation`
- `ConversationMessage`

## Seguridad

- Todas las operaciones de base de datos usan Row Level Security (RLS)
- Las contraseñas no se almacenan en texto plano (Supabase Auth)
- Las cookies de sesión son HTTP-only
- Validación en servidor (Next.js API routes)
- Protección contra SQL injection (Supabase client library)

## Próximos Pasos

1. Personalizar el diseño en `/components` y `/app`
2. Agregar más campos a los formularios según sea necesario
3. Implementar autenticación con email/contraseña
4. Agregar integraciones con WhatsApp Business API
5. Crear reportes y analytics
6. Implementar notificaciones

## Soporte

Para más información:
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de shadcn/ui](https://ui.shadcn.com)
