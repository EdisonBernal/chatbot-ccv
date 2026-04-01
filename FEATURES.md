# Características del CRM de Citas Médicas

## 1. Dashboard Ejecutivo

### Métricas en Tiempo Real
- **Solicitudes Pendientes**: Citas que requieren acción inmediata
- **En Revisión**: Solicitudes siendo procesadas
- **Confirmadas**: Citas confirmadas con pacientes
- **Canceladas**: Solicitudes descartadas
- **Solicitudes Hoy**: Conteo de nuevas solicitudes del día
- **Conversaciones Nuevas**: Chats sin atender
- **En Atención**: Chats activos siendo procesados

### Resumen de Actividad
- Últimas solicitudes de citas
- Últimas conversaciones de WhatsApp
- Links directos a acción requerida

---

## 2. Gestión de Pacientes

### Tabla de Pacientes
- ✅ Búsqueda por nombre, teléfono o documento
- ✅ Filtrado por EPS (aseguradora)
- ✅ Ordenamiento por cualquier columna
- ✅ Paginación automática

### Campos de Paciente
- Nombre completo
- Número de documento (único)
- Teléfono (normalización automática)
- Email
- Fecha de nacimiento
- EPS (Entidad Prestadora de Salud)

### Acciones
- **Crear**: Formulario completo
- **Editar**: Modificar información del paciente
- **Eliminar**: Con confirmación de seguridad
- **Ver detalles**: Información completa con relación a EPS

### Normalización de Teléfonos
- Formato consistente (+X) automático
- Triggers en insert/update
- Índices únicos para prevenir duplicados

---

## 3. Gestión de Solicitudes de Citas

### Estados de Solicitud
- 🔵 **Pendiente**: Recibida, requiere revisión
- 🟡 **En Revisión**: Siendo evaluada por staff
- 🟢 **Confirmada**: Aprobada, cita asignada
- 🔴 **Cancelada**: Rechazada o cancelada

### Tabla de Solicitudes
- Paciente asociado
- Especialidad requerida
- Fecha solicitada
- Estado actual
- Última actualización
- Filtrado por estado
- Edición inline de estado

### Detalle de Solicitud
- Información completa de la solicitud
- Historial de cambios de estado
- Notas internas
- Conversación vinculada (si aplica)
- Botón para cambiar estado

### Historial Completo
- Registro automático de cada cambio
- Usuario que realizó el cambio
- Timestamp exacto
- Notas de cambio
- Fácil auditoría

---

## 4. Kanban de Solicitudes

### Columnas por Estado
- **Pendiente** → **En Revisión** → **Confirmada/Cancelada**

### Funcionalidades
- ✅ Drag & Drop entre columnas
- ✅ Actualización automática de estado
- ✅ Conteo de solicitudes por columna
- ✅ Vista rápida de información clave
- ✅ Edición inline rápida

---

## 5. Conversaciones WhatsApp (Interfaz WhatsApp)

### Interfaz
```
┌─────────────────┬──────────────────────────┐
│ 📱 Mensajes     │ Chat Actual              │
├─────────────────┼──────────────────────────┤
│ 🟢 Juan García  │ 📱 Juan García           │
│ + 57 3001234567 │ +57 3001234567           │
│ "Hola, quisiera │ ────────────────────────│
│ agendar..."     │ Hola, quisiera...       │
│                 │   ✓✓ Te llamamos...     │
│ 🟢 María López  │ ────────────────────────│
│ + 57 3012345678 │ [Escribe mensaje...]    │
│ "Necesito una   │ [Enviar →]              │
│  cita..."       │                          │
│                 │                          │
│ Sin leer: 2     │                          │
└─────────────────┴──────────────────────────┘
```

### Características
- **Punto Verde** (🟢): Indica mensajes nuevos sin leer
- **Estado de Entrega**: ✓ enviado | ✓✓ entregado | ✓✓ azul leído
- **Blue Checks**: Confirmaciones de lectura vía Read Horizon de Twilio
- **Búsqueda**: Filtro en tiempo real
- **Sincronización**: Bidireccional con Twilio Conversations API
- **Broadcasting**: Actualización en tiempo real con Supabase Realtime
- **Historial**: Todos los mensajes guardados con delivery status
- **Responsive**: Lista se oculta en mobile al abrir chat

### Estados de Conversación
- 🆕 **Nueva**: Conversación recién iniciada
- 🎧 **En atención**: Siendo procesada por staff
- ✅ **Cerrada**: Conversación finalizada

### Twilio Conversations API
- Token service con ChatGrant (TTL: 1h)
- Resolución automática de Conversation SID
- Gestión de participantes
- Read Horizon para blue checks
- Webhook con validación HMAC-SHA1
- Eventos: `onMessageAdded`, `onDeliveryUpdated`

---

## 6. Chatbot Automatizado

### Panel Administrativo
- ✅ Lista de configuraciones con crear/editar/eliminar/toggle
- ✅ Editor de pasos con vista previa en tiempo real
- ✅ Constructor de acciones sin código
- ✅ Diálogos intuitivos para crear/editar
- ✅ Vista previa completa del flujo antes de activar
- ✅ Solo accesible para administradores

### Tipos de Triggers
| Trigger | Descripción | Ejemplo |
|---------|-------------|---------|
| **Mensaje Recibido** | Se ejecuta con cualquier mensaje | Saludo automático |
| **Palabra Clave** | Palabras específicas | "cita", "agendar", "horarios" |
| **Tiene Cita Pendiente** | Paciente con cita sin confirmar | Recordatorio |
| **Paciente Nuevo** | Primera interacción | Bienvenida especial |
| **Después de Retardo** | X minutos sin respuesta | Seguimiento, escalación |

### Tipos de Acciones
| Acción | Descripción |
|--------|-------------|
| **Enviar Mensaje** | Mensaje automático con variables dinámicas |
| **Crear Solicitud de Cita** | Crea cita vinculada a la conversación |
| **Recopilar Información** | Solicita datos (email, teléfono, etc.) |
| **Enviar Recordatorio** | Recordatorio personalizado |
| **Derivar a Agente** | Escalación a humano |
| **Actualizar Estado Conversación** | Cambiar estado del chat |
| **Enviar Confirmación** | Confirmación de acción completada |
| **Programar Paso** | Programar siguiente ejecución |

### Variables Dinámicas
- `{{nombre}}`, `{{email}}`, `{{telefono}}`
- `{{fecha_cita}}`, `{{hora_cita}}`, `{{doctor_name}}`
- `{{especialidad}}`, `{{eps}}`

### Motor de Ejecución
- Progresión automática de pasos
- Contexto persistente por conversación
- Mensaje de fallback configurable
- Escalación automática por reintentos
- Logging de ejecución para debugging

---

## 7. Sistema de Notificaciones

### Indicadores Visuales
- **Punto verde** (🟢) en conversaciones sin leer
- **Ticks de entrega**: ✓ enviado, ✓✓ entregado, ✓✓ azul leído
- **Timestamps**: "hace 5 minutos", "hace 2 horas"
- **Estados de color**: Cada estado tiene color único
- **Conteo de no leídos** en la lista de conversaciones

---

## 8. Administración

### Gestión de Especialidades
- ✅ Crear nuevas especialidades
- ✅ Editar información
- ✅ Activar/desactivar
- ✅ Eliminar (con validación)
- Descripción opcional

### Gestión de EPS (Aseguradoras)
- ✅ Agregar EPS
- ✅ Editar información
- ✅ Activar/desactivar
- ✅ Eliminar
- Código opcional

### Gestión de Usuarios
- ✅ Ver usuarios del sistema
- ✅ Asignar rol (Admin / Recepción)
- ✅ Activar/desactivar
- ✅ Cambiar rol

### Configuración del Chatbot
- ✅ Crear flujos automáticos
- ✅ Gestionar pasos y acciones
- ✅ Vista previa del flujo
- ✅ Activar/desactivar chatbots
- ✅ Logs de ejecución

---

## 9. Seguridad y Control de Acceso

### Autenticación
- ✅ Supabase Auth
- ✅ Email y contraseña
- ✅ Sesiones seguras
- ✅ Recovery de contraseña

### Control de Roles
- **Admin**: Acceso total, gestión de usuarios, configuración de chatbot
- **Recepción**: Gestión de pacientes, citas y conversaciones
- **Middleware**: Protección automática de rutas `/dashboard` y `/admin`

### Row Level Security (RLS)
- Usuarios solo ven su perfil (excepto admin)
- Pacientes visibles para autenticados
- Solicitudes según asignación
- Conversaciones según usuario
- Chatbot: solo admin puede configurar

### Validación de Twilio
- ✅ Verificación de firma HMAC-SHA1
- ✅ Solo acepta mensajes de Twilio
- ✅ Previene spoofing
- ✅ Opción de desactivar en desarrollo (`TWILIO_SKIP_SIGNATURE=1`)

---

## 10. Base de Datos

### Tablas Principales
```
users → especialidades / eps
  ↓
pacientes ← eps
  ↓
solicitudes_citas → historial_solicitudes
  ↓
conversaciones → conversaciones_mensajes
  ↓
chatbot_config → chatbot_steps → chatbot_step_actions
  ↓
chatbot_context / chatbot_execution_logs
  ↓
logs_actividad
```

### Características de Datos
- ✅ Integridad referencial
- ✅ Eliminación en cascada (where appropriate)
- ✅ Timestamps automáticos (created_at, updated_at)
- ✅ Índices para búsqueda rápida
- ✅ Auditoría completa
- ✅ Normalización de teléfonos con triggers
- ✅ Enums para tipos y estados (delivery_status, trigger_type, action_type)

---

## 11. Integración Twilio WhatsApp

### Flujo de Mensajes

**Entrante (Cliente → CRM)**
```
1. Cliente envía WhatsApp
2. Twilio Conversations recibe el mensaje
3. Envía Post-Event webhook a: /api/webhooks/twilio
4. Sistema valida firma HMAC-SHA1
5. Guarda mensaje en BD con delivery_status
6. Si hay chatbot activo → procesa mensaje automáticamente
7. Broadcast en tiempo real a clientes conectados
8. Muestra punto verde en UI
```

**Saliente (CRM → Cliente)**
```
1. Staff escribe respuesta en UI
2. Click en "Enviar"
3. Envía mensaje vía Twilio Conversations API
4. Guarda mensaje localmente con status 'sent'
5. Twilio envía WhatsApp al cliente
6. Webhook actualiza delivery_status: sent → delivered → read
7. UI muestra ticks de estado actualizados
```

### Verificación de Seguridad
- Todas las solicitudes incluyen firma HMAC-SHA1
- Solo Twilio puede crear webhooks válidos
- Previene inyección de mensajes falsos

---

## 12. Características Técnicas

### Performance
- ✅ Índices en búsquedas frecuentes
- ✅ Lazy loading de componentes
- ✅ Caché de datos con custom hooks
- ✅ Broadcasting eficiente con Supabase Realtime

### Responsividad
- ✅ Mobile-first design
- ✅ Tablets optimizados
- ✅ Desktop full-featured
- ✅ Interfaz WhatsApp responsive (lista se oculta en mobile)

### Accesibilidad
- ✅ Navegación por teclado
- ✅ Etiquetas semánticas
- ✅ Contraste de colores WCAG
- ✅ Screen reader friendly

---

## Resumen de Funcionalidades

| Característica | Estado | Notas |
|---|---|---|
| Dashboard | ✅ | Métricas en tiempo real |
| Gestión de Pacientes | ✅ | CRUD completo con normalización de teléfono |
| Solicitudes de Citas | ✅ | Con historial automático |
| Kanban Board | ✅ | Drag & drop |
| Conversaciones WhatsApp | ✅ | Interfaz tipo WhatsApp |
| Estado de Entrega | ✅ | queued → sent → delivered → read |
| Blue Checks (Read Receipts) | ✅ | Vía Read Horizon |
| Broadcasting en Tiempo Real | ✅ | Supabase Realtime |
| Indicador de Mensajes Nuevos | ✅ | Punto verde + conteo |
| Integración Twilio | ✅ | Conversations API bidireccional |
| Chatbot Automatizado | ✅ | Motor configurable con triggers y acciones |
| Panel de Chatbot | ✅ | Admin UI con preview |
| Administración | ✅ | Usuarios, Especialidades, EPS, Chatbot |
| Autenticación | ✅ | Supabase Auth |
| Control de Roles | ✅ | Admin / Recepción |
| Normalización de Teléfonos | ✅ | Triggers automáticos |
| Webhook Seguro | ✅ | HMAC-SHA1 |
| RLS | ✅ | Row Level Security |
| Validación de Twilio | ✅ | HMAC verification |
| Auditoria | ✅ | Logs de actividad |
| Mobile | ✅ | Responsivo |
| Accesibilidad | ✅ | WCAG compliant |

---

## Próximas Mejoras Sugeridas

- 📱 App móvil nativa (React Native)
- 🔔 Notificaciones push
- 📊 Dashboard de analytics avanzado
- 📄 Exportación de reportes (PDF, Excel)
- 🎤 Llamadas de voz por WhatsApp
- 📸 Soporte para imágenes en chats
- 🔐 Two-factor authentication (2FA)
- 🌙 Dark mode
- 📧 Integración de email
- 🔗 Integración con calendarios (Google Calendar, Outlook)

---

**Desarrollado con ❤️ usando Next.js, React, Supabase y Twilio**
