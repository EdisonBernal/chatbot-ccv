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
2. Ejecuta los 3 scripts en orden:
   - `scripts/01-init-database.sql`
   - `scripts/02-seed-data.sql`
   - `scripts/03-migration-add-columns.sql`

3. Copia en `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## 3️⃣ Configurar Twilio (1 min)

En tu `.env.local`:
```env
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=+1234567890
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
| **Admin** | http://localhost:3000/dashboard/admin/specialties |

---

## 🆕 Interfaz WhatsApp

La sección de **Conversaciones** ahora tiene interfaz tipo WhatsApp:

```
┌──────────────────┬─────────────────────┐
│ 📱 Chats        │ Chat Actual         │
├──────────────────┼─────────────────────┤
│ 🟢 Juan García   │ Juan García         │
│   "Hola..."      │ +57 3001234567      │
│                  │                     │
│ 🟢 María López   │ Conversación...     │
│   "Necesito..." │                     │
│                  │                     │
│                  │ [Escribe mensaje]   │
└──────────────────┴─────────────────────┘
```

**Punto verde (🟢)** = Mensajes sin leer

---

## 🧪 Testing Twilio

Para probar WhatsApp sin número real:

```bash
# 1. Obtén tu webhook URL (en desarrollo con ngrok):
ngrok http 3000

# 2. Ve a Twilio Console
# 3. Configura webhook en: https://xxxx.ngrok.io/api/webhooks/twilio

# 4. Envía mensaje de prueba desde Twilio Sandbox
# 5. Debería aparecer en /dashboard/conversations
```

---

## 📦 Estructura Importante

```
/dashboard
├── /patients       → Gestión de pacientes
├── /appointments   → Solicitudes de citas
├── /kanban        → Tablero visual
├── /conversations → 💬 WhatsApp
└── /admin         → Configuración
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
