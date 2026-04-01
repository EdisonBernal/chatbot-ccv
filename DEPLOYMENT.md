# Guía de Deployment - Vercel

Esta guía te ayudará a desplegar tu CRM de citas médicas en Vercel.

## Requisitos Previos

1. **Cuenta de Vercel**: https://vercel.com/signup
2. **Repositorio en GitHub**: Tu código debe estar en un repo público o privado
3. **Supabase Project**: Base de datos ya creada y configurada
4. **Twilio Account**: Con Conversations Service y WhatsApp configurado
5. **Git instalado**: Para versión control

## Paso 1: Preparar el Código

### 1.1 Crear Repositorio en GitHub

```bash
# Si aún no has inicializado Git
git init

# Agregar remote
git remote add origin https://github.com/tu-usuario/citas-medicas.git

# Crear rama main
git branch -M main

# Agregar archivos
git add .

# Commit inicial
git commit -m "Initial commit: CRM de citas médicas"

# Push
git push -u origin main
```

### 1.2 Verificar .gitignore

Asegúrate de que `.gitignore` contenga:
```
.env
.env.local
node_modules/
.next/
build/
dist/
```

## Paso 2: Crear Proyecto en Vercel

### 2.1 Conectar Repositorio

1. Ve a https://vercel.com/dashboard
2. Click en "New Project" (Nuevo Proyecto)
3. Selecciona "Import Git Repository"
4. Autoriza a Vercel en GitHub
5. Selecciona tu repositorio `citas-medicas`

### 2.2 Configuración del Proyecto

**Framework Preset**: Next.js (seleccionado automáticamente)
**Root Directory**: ./ (default)
**Build Command**: `pnpm build` (default)
**Output Directory**: `.next`

## Paso 3: Configurar Variables de Entorno

En la página de configuración del proyecto en Vercel:

1. Ve a Settings → Environment Variables
2. Agrega las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_API_KEY=SKxxxxxxxxxx
TWILIO_API_SECRET=your-api-secret
TWILIO_WHATSAPP_NUMBER=+1234567890
CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxx

# URL de la aplicación (para webhooks)
NEXT_PUBLIC_APP_URL=https://citas-medicas.vercel.app
```

### 3.1 Obtener el Valor de NEXT_PUBLIC_APP_URL

- Después del primer deployment, Vercel te asignará una URL como:
  ```
  https://citas-medicas-xxx.vercel.app
  ```
- Usa esta URL para reemplazar en `NEXT_PUBLIC_APP_URL`
- Luego redeploy

## Paso 4: Ejecutar Migraciones de BD

Luego de desplegar por primera vez:

1. Ve a tu proyecto en Supabase
2. Abre el SQL Editor
3. Ejecuta en orden los 10 scripts:
   - `scripts/01-init-database.sql` → Esquema base
   - `scripts/02-seed-data.sql` → Datos de ejemplo
   - `scripts/03-migration-add-columns.sql` → Columnas WhatsApp tracking
   - `scripts/04-chatbot-schema.sql` → Tablas del chatbot
   - `scripts/05-normalize-phone-unique.sql` → Normalización de teléfonos
   - `scripts/06-broadcast-conversation-messages.sql` → Broadcasting en tiempo real
   - `scripts/07-fix-chatbot-config-rls.sql` → RLS chatbot_config
   - `scripts/08-fix-chatbot-steps-rls.sql` → RLS chatbot_steps
   - `scripts/09-chatbot-add-message-delivery-status.sql` → Estado de entrega
   - `scripts/10-conversations-api-migration.sql` → Integración Twilio Conversations API

## Paso 5: Configurar Twilio Conversations Webhook

1. Ve a https://console.twilio.com
2. Navigation → Conversations → Services
3. Selecciona tu Conversations Service (o crea uno nuevo)
4. Ve a Webhooks → Post-Event URL:
   ```
   https://citas-medicas-xxx.vercel.app/api/webhooks/twilio
   ```
5. Habilita los eventos:
   - `onMessageAdded`
   - `onDeliveryUpdated`
6. En Service Settings → habilita **Read Status** para confirmaciones de lectura (blue checks)
7. Guarda los cambios

> **Nota**: NO uses `TWILIO_SKIP_SIGNATURE` en producción. Esa variable es solo para desarrollo.

## Paso 6: Desplegar

### 6.1 Deployment Automático

La primera vez que hiciste git push, Vercel automáticamente:
- ✅ Detectó cambios
- ✅ Construyó el proyecto
- ✅ Desplegó en producción

### 6.2 Futuros Deployments

Simplemente haz push a `main`:
```bash
git add .
git commit -m "Descripción del cambio"
git push origin main
```

Vercel redesplegará automáticamente.

### 6.3 Preview Deployments

Para cada Pull Request, Vercel crea una URL de preview:
- Útil para testing antes de mergear
- URL temporal que se elimina cuando mergeas

## Paso 7: Verificación de Deployment

### 7.1 Revisar Deploy Log

1. Ve a Vercel Dashboard
2. Selecciona tu proyecto
3. Click en "Deployments"
4. Revisa el último deployment
5. Verifica que todo esté ✅ en verde

### 7.2 Prueba de Acceso

1. Abre tu URL: https://citas-medicas-xxx.vercel.app
2. Intenta login con credenciales
3. Verifica que se carguen datos de Supabase

### 7.3 Prueba de Twilio

1. Envía un WhatsApp a tu número de Twilio desde tu celular
2. Verifica que aparezca en `/dashboard/conversations`
3. Responde desde el CRM
4. Verifica que recibas el mensaje en WhatsApp
5. Verifica que los ticks de entrega se actualicen (✓ → ✓✓ → ✓✓ azul)

### 7.4 Prueba del Chatbot

1. Configura un chatbot en `/dashboard/admin/chatbot`
2. Actívalo
3. Envía un mensaje por WhatsApp
4. Verifica que el chatbot responda automáticamente
5. Revisa los logs de ejecución en `chatbot_execution_logs`

## Solución de Problemas

### Build Fallido

**Error**: "Cannot find module"
- Ejecuta `pnpm install` localmente
- Asegúrate de que todas las dependencias estén en `package.json`
- Push los cambios nuevamente

### Variables de Entorno No Cargadas

**Error**: "undefined" en la aplicación
- Verifica que las variables estén en Environment Variables (no en .env)
- Nombres deben coincidir exactamente
- Redeploy después de cambiar variables
- Usa `NEXT_PUBLIC_` para variables visibles en el cliente

### Webhook de Twilio No Funciona

**Error**: Mensajes no aparecen en el CRM
1. Verifica que la Post-Event URL en Twilio Console → Conversations → Service sea correcta
2. Verifica que los eventos `onMessageAdded` y `onDeliveryUpdated` estén habilitados
3. Revisa los logs en Vercel: Deployments → Logs
4. Verifica que `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, y `CONVERSATIONS_SERVICE_SID` sean correctos
5. NO uses `TWILIO_SKIP_SIGNATURE` en producción

### Blue Checks No Funcionan

**Error**: Read receipts no se muestran
1. Verifica que Read Status esté habilitado en el Conversations Service
2. Verifica el endpoint `POST /api/conversations/[id]/read`
3. Revisa que `TWILIO_API_KEY` y `TWILIO_API_SECRET` sean válidos

### Base de Datos Desconectada

**Error**: "Connection refused"
1. Verifica que `NEXT_PUBLIC_SUPABASE_URL` sea correcto
2. Asegúrate de que Supabase esté running
3. Verifica firewall/IP whitelist en Supabase
4. Revisa que el ANON_KEY sea válido

### Chatbot No Responde

1. Verifica que el chatbot esté activo en `/dashboard/admin/chatbot`
2. Revisa los logs en `chatbot_execution_logs`
3. Verifica que los triggers coincidan con los mensajes enviados
4. Revisa la consola de Vercel para errores del webhook

## Monitoreo Posterior al Deployment

### Configurar Alertas

En Vercel Dashboard:
1. Settings → Integrations
2. Conecta Slack (opcional)
3. Recibe notificaciones de failed deployments

### Analytics

En Vercel Dashboard:
1. Analytics → tráfico de la aplicación
2. Performance → velocidad de carga
3. Errors → excepciones

### Logs

```
Vercel Dashboard → Deployments → Logs
```

Ver logs en tiempo real de:
- Requests HTTP
- Errores de la aplicación
- Funciones serverless
- Webhooks de Twilio
- Ejecuciones del chatbot

## Mejores Prácticas

### 1. Staging Environment
- Crea rama `staging` en GitHub
- Vercel crea automáticamente preview
- Test en staging antes de production

### 2. Monitoreo de Errores

Considera agregar:
- **Sentry**: Para reportar errores
- **Vercel Analytics**: Ya incluido en las dependencias (@vercel/analytics)

### 3. Backups
- Supabase realiza backups automáticos
- Revisa la política de retención de tu plan

### 4. Backups de Supabase

En Supabase Dashboard:
1. Settings → Database
2. Enable Backups
3. Configurar frecuencia (diaria, semanal)

## Dominios Personalizados

Para usar tu propio dominio:

1. Ve a Vercel Dashboard → [Tu Proyecto]
2. Settings → Domains
3. Agrega tu dominio
4. Sigue las instrucciones de DNS
5. Vercel generará automáticamente SSL/TLS

Ejemplo:
```
Vercel: citas-medicas-xxx.vercel.app
Tu dominio: citas.tuempresa.com

Configuración DNS:
citas.tuempresa.com → CNAME → citas-medicas-xxx.vercel.app
```

## Auto-scaling y Limites

### Free Plan de Vercel
- ✅ Deployments ilimitados
- ✅ 100 GB bandwidth/mes
- ✅ Auto-scaling automático
- ✅ SSL gratis
- ⚠️ 500 segundos/request máximo

### Pro Plan
- Más bandwidth
- Mejores límites de función
- Soporte prioritario
- Custom domains con SSL

## Rollback

Si algo falla después de deployar:

1. Ve a Vercel Dashboard → Deployments
2. Encuentra el último deployment bueno
3. Click en "..." → "Promote to Production"
4. Se redeploy la versión anterior

## Conclusión

¡Tu CRM de citas médicas está en producción! 🚀

Para más ayuda:
- Docs de Vercel: https://vercel.com/docs
- GitHub Issues: Reporta bugs
- Twilio Support: Para problemas de WhatsApp

---

**Próximos pasos recomendados:**
1. Configurar dominio personalizado
2. Agregar monitoreo de errores (Sentry)
3. Crear plan de backup automático
4. Entrenar al equipo
5. Migrar datos de producción

¡Éxito con tu CRM! 🎉
