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
- Teléfono
- Email
- Fecha de nacimiento
- Género
- EPS (Entidad Prestadora de Salud)
- Dirección
- Historial médico
- Alergias conocidas

### Acciones
- **Crear**: Formulario completo
- **Editar**: Modificar información del paciente
- **Eliminar**: Con confirmación de seguridad
- **Ver detalles**: Información completa

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
- Último actualización
- Filtrado por estado

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

## 5. Conversaciones WhatsApp (Tipo WhatsApp UI)

### Interfaz
```
┌─────────────────┬──────────────────────────┐
│ 📱 Mensajes     │ Chatbot Manager         │
├─────────────────┼──────────────────────────┤
│ 🟢 Juan García  │ (Cuando selecciona)     │
│ + 57 3001234567 │                          │
│ "Hola, quisiera │ 📱 Juan García          │
│ agendar..."     │ +57 3001234567          │
│                 │ ────────────────────────│
│ 🟢 María López  │ Mensajes:               │
│ + 57 3012345678 │ • Hola, quisiera...    │
│ "Necesito una   │ • Te llamamos mañana... │
│  cita..."       │ ────────────────────────│
│                 │ [Escribe mensaje...]   │
│ Sin leer: 2     │ [Enviar →]              │
└─────────────────┴──────────────────────────┘
```

### Características
- **Punto Verde** (🟢): Indica mensajes nuevos sin leer
- **Búsqueda**: Filtro en tiempo real
- **Sincronización**: Bidireccional con Twilio
- **Historial**: Todos los mensajes guardados
- **Responsive**: Lista se oculta en mobile

### Estados de Conversación
- 🆕 **Nueva**: Conversación recién iniciada
- 🎧 **En atención**: Siendo procesada
- ✅ **Resuelta**: Problema solucionado
- 📁 **Archivada**: Cerrada

---

## 6. Sistema de Notificaciones

### Indicadores Visuales
- **Punto verde** (🟢) en conversaciones sin leer
- **Badge rojo** en dashboard con contador
- **Timestamps**: "hace 5 minutos", "hace 2 horas"
- **Estados de color**: Cada estado tiene color único

---

## 7. Administración

### Gestión de Especialidades
- ✅ Crear nuevas especialidades
- ✅ Editar información
- ✅ Activar/desactivar
- ✅ Eliminar (con validación)
- Descripción y ícono opcional

### Gestión de EPS (Aseguradoras)
- ✅ Agregar EPS
- ✅ Editar información
- ✅ Activar/desactivar
- ✅ Eliminar
- Código, teléfono, email, website

### Gestión de Usuarios
- ✅ Crear usuario (email, contraseña)
- ✅ Asignar rol (Admin / Recepción)
- ✅ Activar/desactivar
- ✅ Cambiar rol
- Ver último login

---

## 8. Seguridad y Control de Acceso

### Autenticación
- ✅ Supabase Auth
- ✅ Email y contraseña
- ✅ Sesiones seguras
- ✅ Recovery de contraseña

### Control de Roles
- **Admin**: Acceso total, gestión de usuarios
- **Recepción**: Gestión de pacientes y citas
- **Middleware**: Protección automática de rutas

### Row Level Security (RLS)
- Usuarios solo ven su perfil (excepto admin)
- Pacientes visibles para autenticados
- Solicitudes según asignación
- Conversaciones según usuario

### Validación de Twilio
- ✅ Verificación de firma HMAC
- ✅ Solo acepta mensajes de Twilio
- ✅ Prevents spoofing

---

## 9. Base de Datos

### Tablas Principales
```
users → especialidades
  ↓
pacientes ← eps
  ↓
solicitudes_citas → historial_solicitudes
  ↓
conversaciones → conversaciones_mensajes
  ↓
logs_actividad
```

### Características de Datos
- ✅ Integridad referencial
- ✅ Eliminación en cascada (when appropriate)
- ✅ Timestamps automáticos (created_at, updated_at)
- ✅ Índices para búsqueda rápida
- ✅ Auditoría completa

---

## 10. Integración Twilio WhatsApp

### Flujo de Mensajes

**Entrante (Cliente → CRM)**
```
1. Cliente envía WhatsApp
2. Twilio recibe el mensaje
3. Envía webhook a: /api/webhooks/twilio
4. Sistema valida firma HMAC
5. Crea/actualiza conversación
6. Guarda mensaje en BD
7. Muestra punto verde en UI
```

**Saliente (CRM → Cliente)**
```
1. Staff escribe respuesta en UI
2. Click en "Enviar"
3. Sistema guarda mensaje localmente
4. Envía a API de Twilio
5. Twilio envía WhatsApp al cliente
6. Confirma entrega en UI
```

### Verificación de Seguridad
- Todas las solicitudes incluyen firma HMAC-SHA1
- Solo Twilio puede crear webhooks válidos
- Previene inyección de mensajes falsos

---

## 11. Características Técnicas

### Performance
- ✅ Índices en búsquedas frecuentes
- ✅ Lazy loading de componentes
- ✅ Caché de datos con SWR
- ✅ Optimización de imágenes

### Responsividad
- ✅ Mobile-first design
- ✅ Tablets optimizados
- ✅ Desktop full-featured
- ✅ Gestos táctiles soportados

### Accesibilidad
- ✅ Navegación por teclado
- ✅ Etiquetas semánticas
- ✅ Contraste de colores WCAG
- ✅ Screen reader friendly

---

## 12. Reportes y Análisis

### Disponibles
- Citas por especialidad
- Citas por estado
- Actividad por usuario
- Tiempo promedio de respuesta
- Distribución de pacientes por EPS

### Logs de Sistema
- Quién hizo qué, cuándo
- Cambios de estado
- Acceso de usuarios
- Errores y excepciones

---

## Resumen de Funcionalidades

| Característica | Estado | Notas |
|---|---|---|
| Dashboard | ✅ | Métricas en tiempo real |
| Gestión de Pacientes | ✅ | CRUD completo |
| Solicitudes de Citas | ✅ | Con historial |
| Kanban Board | ✅ | Drag & drop |
| Conversaciones WhatsApp | ✅ | Tipo WhatsApp UI |
| Indicador de Mensajes Nuevos | ✅ | Punto verde |
| Integración Twilio | ✅ | Bidireccional |
| Administración | ✅ | Usuarios, Especialidades, EPS |
| Autenticación | ✅ | Supabase Auth |
| Control de Roles | ✅ | Admin / Recepción |
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
