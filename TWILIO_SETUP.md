# Configuración de Twilio WhatsApp (Conversations API)

Esta guía te ayudará a configurar la integración de WhatsApp con Twilio Conversations API en tu CRM de citas médicas.

## Paso 1: Crear una Cuenta Twilio

1. Ve a https://www.twilio.com/
2. Haz clic en "Sign up" y completa el registro
3. Verifica tu email
4. En el panel de control (Console), anota:
   - **Account SID**: Se ve en la parte superior derecha
   - **Auth Token**: Se ve junto al Account SID

## Paso 2: Solicitar WhatsApp Business Account

1. Ve a https://www.twilio.com/console
2. En el menú lateral, busca "Messaging" → "Services"
3. Busca la opción de "Try the Messaging API"
4. Selecciona "WhatsApp" como canal
5. Sigue el flujo de configuración:
   - Conecta o crea una cuenta de WhatsApp Business
   - Verifica el número de teléfono que usarás
   - Aprueba el acceso

## Paso 3: Obtener el Número de WhatsApp Business

1. Una vez aprobada tu cuenta WhatsApp Business:
   - Ve a Messaging → WhatsApp → Senders en el console
   - Anota el número asignado (ej: +1234567890)

2. **Importante**: Este debe ser un número verificado por Twilio

## Paso 4: Crear un Conversations Service

1. Ve a https://console.twilio.com → Conversations → Services
2. Crea un nuevo Service (o usa el default)
3. Anota el **Conversations Service SID** (empieza con `IS`)
4. En la configuración del Service:
   - Habilita **Read Status** (necesario para blue checks)
   - Nota: esto permite que Twilio rastree cuándo los mensajes son leídos

## Paso 5: Crear API Key y API Secret

1. Ve a https://console.twilio.com → Account → API keys & tokens
2. Crea una nueva API Key:
   - Tipo: Standard
   - Nombre: "CRM Chatbot" (o el que prefieras)
3. Anota:
   - **API Key SID** (empieza con `SK`)
   - **API Secret** (se muestra solo una vez, guárdalo)

## Paso 6: Configurar Variables de Entorno

Copia `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```

Actualiza los valores:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your-api-secret-here
TWILIO_WHATSAPP_NUMBER=+1234567890
CONVERSATIONS_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxx

# App URL
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# Desarrollo (opcional - omitir validación de firma)
# TWILIO_SKIP_SIGNATURE=1
```

## Paso 7: Configurar el Webhook en Twilio Conversations

### 7.1 Post-Event Webhook

1. En Twilio Console → Conversations → Services → Tu Service
2. Ve a la sección **Webhooks**
3. En **Post-Event URL**, configura:
   ```
   https://tu-dominio.com/api/webhooks/twilio
   ```
4. Método: **POST**
5. Habilita los siguientes eventos:
   - ✅ `onMessageAdded` - Para recibir mensajes entrantes
   - ✅ `onDeliveryUpdated` - Para rastrear estados de entrega

### 7.2 Verificar Configuración del Service

En Conversations → Services → Tu Service → Settings:
- ✅ **Read Status**: Habilitado (para blue checks)
- La integración de WhatsApp debe estar vinculada al Service

## Paso 8: Testing Local (Desarrollo)

Para probar localmente sin desplegar, usa **ngrok**:

1. Descarga ngrok desde https://ngrok.com/download
2. Instálalo y crea una cuenta
3. Ejecuta:
```bash
ngrok http 3000
```
4. Verás una URL como: `https://xxxx-xx-xxx-xx.ngrok.io`
5. Usa esta URL en los webhooks de Twilio:
   ```
   https://xxxx-xx-xxx-xx.ngrok.io/api/webhooks/twilio
   ```

**Tip para desarrollo**: Puedes agregar `TWILIO_SKIP_SIGNATURE=1` en `.env.local` para omitir la validación de firma HMAC durante testing local. **NUNCA uses esto en producción.**

## Paso 9: Desplegar a Producción

1. Despliega tu proyecto a Vercel (ver [DEPLOYMENT.md](./DEPLOYMENT.md))

2. Una vez desplegado, obtén tu URL de Vercel (ej: `https://citas-medicas.vercel.app`)

3. Actualiza el Post-Event Webhook en Twilio Conversations:
   ```
   https://citas-medicas.vercel.app/api/webhooks/twilio
   ```

4. Configura las variables de entorno en Vercel:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_API_KEY`
   - `TWILIO_API_SECRET`
   - `TWILIO_WHATSAPP_NUMBER`
   - `CONVERSATIONS_SERVICE_SID`
   - `NEXT_PUBLIC_APP_URL`

## Paso 10: Probar la Integración

### Prueba básica de mensajes
1. Desde tu teléfono, abre WhatsApp
2. Envía un mensaje a tu número de WhatsApp Business
3. Debería aparecer automáticamente en tu CRM en `/dashboard/conversations`
4. Puedes responder desde el CRM y el mensaje se enviará por WhatsApp

### Prueba de estados de entrega
1. Envía un mensaje desde el CRM
2. Deberías ver: ✓ (enviado) → ✓✓ (entregado) → ✓✓ azul (leído)

### Prueba del chatbot
1. Configura un chatbot en `/dashboard/admin/chatbot`
2. Actívalo
3. Envía un mensaje por WhatsApp que coincida con un trigger
4. El chatbot debería responder automáticamente

## Funcionalidades de la Integración

### Token Service
- El sistema genera JWT Access Tokens con ChatGrant para el SDK frontend
- TTL de 1 hora por token
- Resolución automática de Conversation SID
- Gestión de participantes

### Read Horizon (Blue Checks)
- El frontend avanza el Read Horizon cuando el usuario ve mensajes
- Twilio notifica al remitente que el mensaje fue leído
- Se refleja en WhatsApp como blue checks

### Delivery Status Tracking
- **queued**: Mensaje en cola
- **sent**: Enviado al destinatario
- **delivered**: Entregado al dispositivo
- **read**: Leído por el destinatario

### Webhook Handler
- Validación HMAC-SHA1 de firma de Twilio
- Procesamiento de eventos `onMessageAdded` y `onDeliveryUpdated`
- Ejecución automática del chatbot
- Broadcasting en tiempo real vía Supabase Realtime
- Soporte legacy para Messaging API (backward compatibility)

## Validación de Firma (Seguridad)

El webhook valida automáticamente que los mensajes provienen de Twilio usando:
- El **Auth Token** de Twilio
- La **firma X-Twilio-Signature**
- Algoritmo HMAC-SHA1

Esto evita que mensajes falsos se procesen en tu aplicación.

## Solución de Problemas

### Los mensajes no aparecen en el CRM
1. Verifica que el Post-Event URL del Conversations Service sea correcto
2. Verifica que los eventos `onMessageAdded` estén habilitados
3. Abre Twilio Console → Monitor → Logs para ver errores
4. Verifica que la base de datos Supabase esté funcionando
5. Revisa las tablas `conversations` y `conversation_messages`

### Blue checks no funcionan
1. Verifica que **Read Status** esté habilitado en el Conversations Service
2. Verifica que `onDeliveryUpdated` esté habilitado en webhooks
3. Revisa el endpoint `/api/conversations/[id]/read`

### Error "Webhook response failed"
- Verifica que tu servidor esté respondiendo correctamente
- El endpoint debe retornar un status 200
- Todos los errores deben capturarse para evitar reintentos de Twilio

### Firma de Twilio no válida
- Verifica que `TWILIO_AUTH_TOKEN` sea exacto
- No cambies el Auth Token sin actualizar las variables de entorno
- En desarrollo, usa `TWILIO_SKIP_SIGNATURE=1` temporalmente

### Token no se genera
- Verifica que `TWILIO_API_KEY` y `TWILIO_API_SECRET` sean válidos
- Verifica que `CONVERSATIONS_SERVICE_SID` sea correcto
- Revisa los logs del endpoint `/api/twilio/token`

## Costo Estimado

- Twilio ofrece crédito gratis inicial ($15 USD)
- Costo por mensaje WhatsApp: ~$0.0075 USD por mensaje enviado/recibido
- Conversations API: consultar precios en https://www.twilio.com/conversations/pricing
- La mayoría de planes son pay-as-you-go

Para más información, ve a https://www.twilio.com/pricing

## Soporte

- Documentación Twilio Conversations: https://www.twilio.com/docs/conversations
- Twilio WhatsApp: https://www.twilio.com/docs/whatsapp
- Panel de control: https://console.twilio.com

## Notas Importantes

1. **Sandbox vs Producción**: Si usas un número en Sandbox (prueba), solo funcionará con números autorizados
2. **Aprobación**: La aprobación de WhatsApp Business puede tomar 24-48 horas
3. **Límites Sandbox**: 100 mensajes/día en modo sandbox
4. **API Key**: Guarda el API Secret de forma segura, no se puede recuperar después de crearlo
5. **Conversations Service**: Un Service puede manejar múltiples conversaciones y canales
