# 🚀 Quick Start - 5 Minutos

Para los que aman ir rápido, aquí está todo lo que necesitas en 5 pasos.

---

## 1️⃣ Clonar y Setup (1 min)

```bash
# Instalar dependencias
pnpm install

# Copiar variables
cp .env.example .env.local
```

## 2️⃣ Configurar Supabase (2 min)

### En tu proyecto de Supabase:

1. Abre el **SQL Editor**
2. Ejecuta los 10 scripts en orden:
   - `scripts/01-init-database.sql` → Esquema base
   - `scripts/02-seed-data.sql` → Datos de ejemplo
   - `scripts/03-migration-add-columns.sql` → Columnas WhatsApp
   - `scripts/04-chatbot-schema.sql` → Tablas del chatbot
   - `scripts/05-normalize-phone-unique.sql` → Normalización de teléfonos
   - `scripts/06-broadcast-conversation-messages.sql` → Broadcasting en tiempo real
   - `scripts/07-fix-chatbot-config-rls.sql` → RLS chatbot_config
   - `scripts/08-fix-chatbot-steps-rls.sql` → RLS chatbot_steps
   - `scripts/09-chatbot-add-message-delivery-status.sql` → Estado de entrega
   - `scripts/10-conversations-api-migration.sql` → Integración Twilio Conversations API

3. Copia en `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## 3️⃣ Configurar Twilio (1 min)

En tu `.env.local`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_API_KEY=SKxxxxxxxxxx
TWILIO_API_SECRET=tu_api_secret
TWILIO_WHATSAPP_NUMBER=+1234567890
CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> 📌 **Nota**: Si aún no tienes Twilio, ver `TWILIO_SETUP.md` para setup completo

## 4️⃣ Iniciar Servidor (30 seg)

```bash
pnpm dev
```

Abre http://localhost:3000

## 5️⃣ Login y Explorar (30 seg)

```
Email: test@example.com
Password: password
```

---

## 🎯 URLs Importantes

| Sección | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000/dashboard |
| **Pacientes** | http://localhost:3000/dashboard/patients |
| **Solicitudes** | http://localhost:3000/dashboard/appointments |
| **Kanban** | http://localhost:3000/dashboard/kanban |
| **💬 WhatsApp** | http://localhost:3000/dashboard/conversations |
| **Admin - Especialidades** | http://localhost:3000/dashboard/admin/specialties |
| **Admin - EPS** | http://localhost:3000/dashboard/admin/eps |
| **Admin - Usuarios** | http://localhost:3000/dashboard/admin/users |
| **🤖 Chatbot** | http://localhost:3000/dashboard/admin/chatbot |

---

## 🆕 Interfaz WhatsApp

La sección de **Conversaciones** tiene interfaz tipo WhatsApp:

```
┌──────────────────┬─────────────────────┐
│ 📱 Chats        │ Chat Actual         │
├──────────────────┼─────────────────────┤
│ 🟢 Juan García   │ Juan García         │
│   "Hola..."      │ +57 3001234567      │
│                  │                     │
│ 🟢 María López   │ ✓✓ Conversación... │
│   "Necesito..." │                     │
│                  │                     │
│                  │ [Escribe mensaje]   │
└──────────────────┴─────────────────────┘
```

- **Punto verde (🟢)** = Mensajes sin leer
- **✓** = Enviado | **✓✓** = Entregado | **✓✓ azul** = Leído

---

## 🤖 Chatbot Automatizado

Configura flujos automáticos en **Dashboard → Admin → Chatbot**:

1. Crea una configuración (nombre, mensajes, reintentos)
2. Agrega pasos con triggers (palabra clave, mensaje recibido, etc.)
3. Agrega acciones (enviar mensaje, crear cita, derivar a agente, etc.)
4. Activa el chatbot y responderá automáticamente por WhatsApp

Ver [CHATBOT_GUIDE.md](./CHATBOT_GUIDE.md) para la guía completa.

---

## 🧪 Testing Twilio

Para probar WhatsApp sin número real:

```bash
# 1. Obtén tu webhook URL (en desarrollo con ngrok):
ngrok http 3000

# 2. Ve a Twilio Console → Conversations → Service → Webhooks
# 3. Configura Post-Event URL: https://xxxx.ngrok.io/api/webhooks/twilio
# 4. Habilita eventos: onMessageAdded, onDeliveryUpdated

# 5. Envía mensaje de prueba desde WhatsApp
# 6. Debería aparecer en /dashboard/conversations
```

---

## 📦 Estructura Importante

```
/dashboard
├── /patients       → Gestión de pacientes
├── /appointments   → Solicitudes de citas
├── /kanban        → Tablero visual
├── /conversations → 💬 WhatsApp (con delivery status y blue checks)
└── /admin
    ├── /specialties → Especialidades médicas
    ├── /eps         → Aseguradoras
    ├── /users       → Usuarios y roles
    └── /chatbot     → 🤖 Configuración de chatbot
```

---

## 🔐 Usuarios de Prueba

Se crean automáticamente en `scripts/02-seed-data.sql`:

```
Rol Admin:
- Email: admin@test.com
- Password: password

Rol Recepción:
- Email: reception@test.com
- Password: password
```

---

## ⚡ Comandos Útiles

```bash
# Desarrollo
pnpm dev              # Inicia servidor

# Producción
pnpm build           # Compila
pnpm start           # Inicia producción

# Base de datos
pnpm db:push         # Sincroniza schema (si usas ORM)

# Tipos
pnpm type-check      # Valida tipos TypeScript
```

---

## 🐛 Troubleshooting Rápido

### Error: "Cannot find Supabase URL"
```env
# Verifica estos en .env.local:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Error: "Webhook failed"
```bash
# Instala ngrok para testing local:
ngrok http 3000

# Usa: https://xxxx.ngrok.io/api/webhooks/twilio
```

### Mensajes de Twilio no aparecen
1. Verifica que `TWILIO_WHATSAPP_NUMBER` sea correcto (sin `whatsapp:`)
2. Comprueba que el webhook esté configurado en Twilio
3. Abre console de navegador (F12) y revisa errores

---

## 🎓 Documentación Completa

Si necesitas más detalle, lee:

1. **README.md** - Overview general
2. **FEATURES.md** - Todas las características
3. **TWILIO_SETUP.md** - Setup completo de Twilio
4. **DEPLOYMENT.md** - Desplegar a producción
5. **IMPLEMENTATION_SUMMARY.md** - Resumen técnico

---

## ✨ Features Principales

✅ **Dashboard**: Métricas en tiempo real
✅ **Pacientes**: CRUD completo
✅ **Citas**: Estados + historial
✅ **Kanban**: Drag & drop visual
✅ **WhatsApp**: Interfaz tipo app
✅ **Admin**: Usuarios, EPS, especialidades
✅ **Seguridad**: Roles + RLS

---

## 🚀 Deploying a Vercel

```bash
# 1. Push a GitHub
git add .
git commit -m "Initial commit"
git push origin main

# 2. Vercel detecta cambios
# 3. Deploy automático en minutos
# 4. Tu URL: https://tu-proyecto.vercel.app

# 5. Configurar variables en Vercel:
# Settings → Environment Variables
```

Ver **DEPLOYMENT.md** para guía completa.

---

## 🎉 ¡Listo!

Ya tienes un CRM profesional de citas médicas con WhatsApp integrado.

**Próximo paso**: Comenzar a usar o desplegar a producción.

---

**Preguntas?** Revisa los archivos de documentación en la raíz del proyecto.

**Éxito!** 🚀
