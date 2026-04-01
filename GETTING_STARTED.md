# Guía de Inicio - CRM de Citas Médicas

## 1. Configuración Inicial

### 1.1 Variables de Entorno
Copia `.env.example` a `.env.local` y completa con tus credenciales:

```bash
cp .env.example .env.local
```

**Necesitarás:**
- URL y Anon Key de Supabase
- Account SID, Auth Token y número de Twilio

### 1.2 Base de Datos
1. Ve a tu proyecto Supabase
2. Abre SQL Editor
3. Ejecuta el script `/scripts/01-init-database.sql` para crear tablas y políticas RLS
4. (Opcional) Ejecuta `/scripts/02-seed-data.sql` para datos de prueba

### 1.3 Ejecutar Localmente

```bash
pnpm install
pnpm dev
```

Abre http://localhost:3000

## 2. Primeros Pasos en la Aplicación

### 2.1 Crear Usuario Admin
1. Ve a Supabase > Authentication > Users
2. Crear un usuario con email y contraseña
3. En la tabla `users`, crear registro con:
   - `id`: el UUID de auth.users
   - `email`: el email
   - `full_name`: nombre
   - `role`: 'admin'
   - `is_active`: true

### 2.2 Login
- Usa tus credenciales en http://localhost:3000/auth/login
- Serás redirigido a `/dashboard`

### 2.3 Dashboard
El dashboard muestra:
- Métricas de solicitudes (pendientes, confirmadas, etc.)
- Últimas solicitudes creadas
- Últimas conversaciones
- Acceso rápido a todos los módulos

## 3. Gestión de Pacientes

### 3.1 Crear Paciente
1. Ve a "Pacientes" en el sidebar
2. Haz clic en "Agregar Paciente"
3. Completa el formulario
4. Guarda

**Campos importantes:**
- Nombre completo *
- Teléfono *
- Email
- Documento (tipo y número)
- EPS (aseguradora)
- Alergias
- Antecedentes médicos

### 3.2 Editar/Eliminar
- Haz clic en el botón editar (lápiz) en la tabla
- O elimina con el ícono de papelera

## 4. Solicitudes de Citas

### 4.1 Crear Solicitud
1. Ve a "Solicitudes" en el sidebar
2. Haz clic en "Nueva Solicitud"
3. Selecciona paciente, especialidad, fecha
4. Guarda

**Estados disponibles:**
- **Pendiente**: Acaba de crearse
- **En revisión**: Siendo evaluada
- **Confirmada**: Cita aprobada
- **Cancelada**: Cita rechazada

### 4.2 Cambiar Estado
1. Abre la solicitud (clic en ella)
2. Ve la sección "Estado" abajo
3. Haz clic en el nuevo estado
4. (Opcional) Agrega una nota
5. Guarda

**Se registra automáticamente:**
- Quién hizo el cambio
- Cuándo se realizó
- Qué nota se escribió

### 4.3 Kanban Board
Vista alternativa para gestionar solicitudes:
- **Columnas**: Pendiente, En revisión, Confirmada, Cancelada
- **Drag & drop**: Arrastra solicitudes entre estados
- **Útil para**: Gestión visual rápida

## 5. Conversaciones WhatsApp

### 5.1 Integración Twilio
1. Crea cuenta en https://www.twilio.com
2. Obtén Account SID y Auth Token
3. Configura WhatsApp Sandbox
4. En WhatsApp Settings, configura el webhook:
   ```
   https://tu-dominio.com/api/webhooks/twilio
   ```

### 5.2 Recibir Mensajes
- Los mensajes de WhatsApp llegan automáticamente
- Se crean conversaciones nuevas automáticamente
- Se vinculan al paciente si existe con ese teléfono

### 5.3 Responder Mensajes
1. Ve a "Conversaciones"
2. Abre una conversación
3. Escribe tu respuesta
4. Presiona Enter o click en enviar

## 6. Administración

### 6.1 Especialidades
1. Ve a "Administración" > "Especialidades"
2. Agregar nueva especialidad escribiendo el nombre
3. Eliminar con el botón papelera

### 6.2 Aseguradoras (EPS)
1. Ve a "Administración" > "EPS"
2. Agregar nueva aseguradora con nombre y código
3. Eliminar con el botón papelera

### 6.3 Usuarios
**Solo Admin puede:**
1. Ver "Administración" > "Usuarios"
2. Crear usuarios (vía Supabase auth)
3. Asignar roles (admin/recepcion)
4. Eliminar usuarios

## 7. Mejores Prácticas

### Para Admins
- Revisa regularmente las conversaciones sin responder
- Mantén las especialidades y EPS actualizadas
- Verifica que los usuarios tengan permisos correctos

### Para Recepción
- Crea solicitudes apenas llame el paciente
- Vincula conversaciones a solicitudes
- Cambia estados rápidamente para mantener seguimiento

### General
- Completa todos los campos requeridos
- Usa búsqueda para encontrar pacientes
- Revisa el historial de cambios en solicitudes

## 8. Troubleshooting

### No puedo login
- Verifica que el usuario exista en Supabase > Authentication
- Verifica que hay un registro en la tabla `users`
- Confirma que el email está verificado

### No veo la especialidad en solicitudes
- Revisa que la especialidad esté creada en Administración
- Verifica que `is_active = true` en la BD

### Mensajes de Twilio no llegan
- Configura correctamente el webhook en Twilio console
- Usa http://localhost:3000 para testing local (usa ngrok)
- Verifica TWILIO_ACCOUNT_SID y AUTH_TOKEN

### El formulario no guarda
- Revisa la consola del navegador (F12 > Console)
- Verifica que Supabase está conectado
- Comprueba que tienes permisos RLS

## 9. Recursos Útiles

- [Documentación Supabase](https://supabase.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## 10. Soporte

Si encuentras problemas:
1. Revisa los logs en el navegador (F12)
2. Verifica las variables de entorno
3. Consulta la documentación del README.md
4. Contacta al equipo de soporte

---

¡Bienvenido a MediCRM! 🏥
