# Guía de Inicio - CRM de Citas Médicas

## 1. Configuración Inicial

### 1.1 Variables de Entorno
Copia `.env.example` a `.env.local` y completa con tus credenciales:

```bash
cp .env.example .env.local
```

**Necesitarás:**
- URL, Anon Key y Service Role Key de Supabase
- Account SID, Auth Token, API Key, API Secret de Twilio
- Número de WhatsApp y Conversations Service SID de Twilio

### 1.2 Base de Datos
1. Ve a tu proyecto Supabase
2. Abre SQL Editor
3. Ejecuta los scripts en orden:
   - `scripts/01-init-database.sql` → Esquema base (tablas, RLS, índices)
   - `scripts/02-seed-data.sql` → Datos de ejemplo (opcional)
   - `scripts/03-migration-add-columns.sql` → Columnas WhatsApp tracking
   - `scripts/04-chatbot-schema.sql` → Tablas del chatbot
   - `scripts/05-normalize-phone-unique.sql` → Normalización de teléfonos
   - `scripts/06-broadcast-conversation-messages.sql` → Broadcasting en tiempo real
   - `scripts/07-fix-chatbot-config-rls.sql` → RLS chatbot_config
   - `scripts/08-fix-chatbot-steps-rls.sql` → RLS chatbot_steps
   - `scripts/09-chatbot-add-message-delivery-status.sql` → Estado de entrega
   - `scripts/10-conversations-api-migration.sql` → Integración Twilio Conversations API

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
   - `auth_id`: el UUID de auth.users
   - `email`: el email
   - `full_name`: nombre
   - `role`: 'admin'
   - `is_active`: true

### 2.2 Login
- Usa tus credenciales en http://localhost:3000/auth/login
- Serás redirigido a `/dashboard`

### 2.3 Dashboard
El dashboard muestra:
- Métricas de solicitudes (pendientes, en revisión, confirmadas, canceladas)
- Total de solicitudes del día
- Conversaciones nuevas y en atención
- Últimas solicitudes y conversaciones recientes
- Acceso rápido a todos los módulos

## 3. Gestión de Pacientes

### 3.1 Crear Paciente
1. Ve a "Pacientes" en el sidebar
2. Haz clic en "Agregar Paciente"
3. Completa el formulario
4. Guarda

**Campos importantes:**
- Nombre completo *
- Teléfono * (se normaliza automáticamente)
- Email
- Tipo y número de documento
- EPS (aseguradora)
- Fecha de nacimiento

### 3.2 Editar/Eliminar
- Haz clic en el botón editar (lápiz) en la tabla
- O elimina con el ícono de papelera (con confirmación)

### 3.3 Búsqueda
- Busca por nombre, teléfono o número de documento
- Filtra por EPS

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
- **Conteo**: Muestra cantidad de solicitudes por columna

## 5. Conversaciones WhatsApp

### 5.1 Integración Twilio Conversations API
La integración usa la API de Conversations de Twilio para:
- Mensajería bidireccional
- Estados de entrega (sent, delivered, read)
- Confirmaciones de lectura (blue checks) vía Read Horizon
- Broadcasting en tiempo real

### 5.2 Configurar Twilio
1. Crea cuenta en https://www.twilio.com
2. Crea un Conversations Service
3. Obtén API Key y API Secret
4. Configura las variables de entorno:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
   TWILIO_AUTH_TOKEN=tu-auth-token
   TWILIO_API_KEY=SKxxxxxxxxxx
   TWILIO_API_SECRET=tu-api-secret
   TWILIO_WHATSAPP_NUMBER=+1234567890
   CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxx
   ```
5. Configura el Post-Event Webhook en Twilio Console → Conversations → Service:
   ```
   https://tu-dominio.com/api/webhooks/twilio
   ```
6. Habilita eventos: `onMessageAdded`, `onDeliveryUpdated`

### 5.3 Recibir Mensajes
- Los mensajes de WhatsApp llegan automáticamente vía webhook
- Se valida la firma HMAC-SHA1 de Twilio
- Se crean conversaciones nuevas automáticamente
- Se vinculan al paciente si existe con ese teléfono
- Si hay un chatbot activo, procesa el mensaje automáticamente

### 5.4 Responder Mensajes
1. Ve a "Conversaciones"
2. Abre una conversación de la lista izquierda
3. Escribe tu respuesta en el campo de texto
4. Presiona Enter o clic en enviar
5. Verás el estado de entrega: ✓ enviado, ✓✓ entregado, ✓✓ azul leído

### 5.5 Indicadores Visuales
- **Punto verde (🟢)**: Mensajes sin leer en la conversación
- **Estado de entrega**: Ticks de estado por cada mensaje enviado
- **Búsqueda**: Filtro en tiempo real en la lista de conversaciones

## 6. Chatbot Automatizado

### 6.1 Acceso
- Dashboard → Admin → Chatbot (solo administradores)
- URL: `/dashboard/admin/chatbot`

### 6.2 Crear Chatbot
1. Clic en "Nuevo Chatbot"
2. Configura: nombre, mensaje de bienvenida, fallback, escalación, reintentos
3. Agrega pasos con triggers:
   - **Mensaje recibido**: cualquier mensaje
   - **Palabra clave**: palabras específicas (ej: "cita", "agendar")
   - **Tiene cita pendiente**: si el paciente tiene cita sin confirmar
   - **Paciente nuevo**: primer mensaje de un paciente
   - **Después de retardo**: tras X minutos sin respuesta
4. Agrega acciones a cada paso:
   - Enviar mensaje (con variables dinámicas)
   - Crear solicitud de cita
   - Recopilar información
   - Enviar recordatorio
   - Derivar a agente
   - Actualizar estado de conversación
5. Usa la vista previa para verificar el flujo
6. Activa el chatbot

### 6.3 Variables Dinámicas
Personaliza mensajes con: `{{nombre}}`, `{{email}}`, `{{telefono}}`, `{{fecha_cita}}`, `{{hora_cita}}`, `{{doctor_name}}`, `{{especialidad}}`, `{{eps}}`

Ver [CHATBOT_GUIDE.md](./CHATBOT_GUIDE.md) para la guía completa.

## 7. Administración

### 7.1 Especialidades
1. Ve a "Administración" > "Especialidades"
2. Agregar nueva especialidad (nombre, descripción)
3. Activar/desactivar especialidades
4. Eliminar con el botón papelera

### 7.2 Aseguradoras (EPS)
1. Ve a "Administración" > "EPS"
2. Agregar nueva aseguradora (nombre, descripción, código opcional)
3. Activar/desactivar
4. Eliminar con el botón papelera

### 7.3 Usuarios
**Solo Admin puede:**
1. Ver "Administración" > "Usuarios"
2. Crear usuarios (vía Supabase Auth)
3. Asignar roles (admin/recepcion)
4. Activar/desactivar usuarios

### 7.4 Chatbot
**Solo Admin puede:**
1. Ver "Administración" > "Chatbot"
2. Crear y configurar flujos automáticos
3. Gestionar pasos y acciones
4. Activar/desactivar chatbots
5. Revisar logs de ejecución

## 8. Mejores Prácticas

### Para Admins
- Revisa regularmente las conversaciones sin responder
- Mantén las especialidades y EPS actualizadas
- Verifica que los usuarios tengan permisos correctos
- Configura el chatbot para preguntas frecuentes
- Revisa los logs de ejecución del chatbot

### Para Recepción
- Crea solicitudes apenas llame el paciente
- Vincula conversaciones a solicitudes
- Cambia estados rápidamente para mantener seguimiento
- Atiende conversaciones con punto verde (mensajes nuevos)

### General
- Completa todos los campos requeridos
- Usa búsqueda para encontrar pacientes
- Revisa el historial de cambios en solicitudes

## 9. Troubleshooting

### No puedo login
- Verifica que el usuario exista en Supabase > Authentication
- Verifica que hay un registro en la tabla `users`
- Confirma que el email está verificado

### No veo la especialidad en solicitudes
- Revisa que la especialidad esté creada en Administración
- Verifica que `is_active = true` en la BD

### Mensajes de Twilio no llegan
- Verifica que el Post-Event Webhook URL sea correcto en Twilio Console → Conversations
- Usa ngrok para testing local
- Verifica que están habilitados los eventos `onMessageAdded` y `onDeliveryUpdated`
- Verifica `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, y `CONVERSATIONS_SERVICE_SID`
- En desarrollo, puedes usar `TWILIO_SKIP_SIGNATURE=1` para omitir validación de firma

### Blue checks no aparecen
- Verifica que Read Status esté habilitado en el Conversations Service de Twilio
- Verifica el endpoint `POST /api/conversations/[id]/read`

### El chatbot no responde
- Verifica que la configuración esté activa (badge "Activo")
- Revisa los logs de ejecución en `chatbot_execution_logs`
- Verifica que los triggers coincidan con los mensajes
- Consulta [CHATBOT_GUIDE.md](./CHATBOT_GUIDE.md) para solución de problemas

### El formulario no guarda
- Revisa la consola del navegador (F12 > Console)
- Verifica que Supabase está conectado
- Comprueba que tienes permisos RLS

## 10. Recursos Útiles

- [Documentación Supabase](https://supabase.com/docs)
- [Twilio Conversations API](https://www.twilio.com/docs/conversations)
- [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## 11. Soporte

Si encuentras problemas:
1. Revisa los logs en el navegador (F12)
2. Verifica las variables de entorno
3. Consulta la documentación del README.md
4. Revisa los logs de ejecución del chatbot
5. Contacta al equipo de soporte

---

¡Bienvenido a MediCRM! 🏥
