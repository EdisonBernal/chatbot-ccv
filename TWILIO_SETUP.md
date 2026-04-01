# Configuración de Twilio WhatsApp

Esta guía te ayudará a configurar la integración de WhatsApp con Twilio en tu CRM de citas médicas.

## Paso 1: Crear una Cuenta Twilio

1. Ve a https://www.twilio.com/
2. Haz clic en "Sign up" y completa el registro
3. Verifica tu email
4. En el panel de control (Console), anota:
   - **Account SID**: Se ve en la parte superior derecha
   - **Auth Token**: Se ve junto al Account SID

## Paso 2: Solicitar WhatsApp Business Account

1. Ve a https://www.twilio.com/console
2. En el menú lateral, busca "Messaging" → "Services" (o "Phone Numbers")
3. Busca la opción de "Try the Messaging API"
4. Selecciona "WhatsApp" como canal
5. Sigue el flujo de configuración:
   - Conecta o crea una cuenta de WhatsApp Business
   - Verifica el número de teléfono que usarás
   - Aprueba el acceso

## Paso 3: Obtener el Número de WhatsApp Business

1. Una vez aprobada tu cuenta WhatsApp Business:
   - Ve a Messaging → WhatsApp (en el console)
   - Busca "Phone Numbers" o "Senders"
   - Anota el número asignado (ej: +1234567890)

2. **Importante**: Este debe ser un número verificado por Twilio

## Paso 4: Configurar Variables de Entorno

1. Copia `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```

2. Actualiza los valores con tu información de Twilio:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_WHATSAPP_NUMBER=+1234567890
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

## Paso 5: Configurar el Webhook en Twilio

1. En la consola de Twilio, ve a Messaging → WhatsApp → Senders
2. Haz clic en tu número de WhatsApp verificado
3. Busca "Webhook Settings" o "Message Settings"
4. En "When a message arrives" (Webhook POST URL), configura:
   ```
   https://tu-dominio.com/api/webhooks/twilio
   ```
5. Asegúrate de que el método sea **POST**
6. Guarda los cambios

## Paso 6: Testing Local (Desarrollo)

Para probar localmente sin desplegar, usa **ngrok**:

1. Descarga ngrok desde https://ngrok.com/download
2. Instálalo y crea una cuenta
3. Ejecuta:
```bash
ngrok http 3000
```
4. Verás una URL como: `https://xxxx-xx-xxx-xx.ngrok.io`
5. Usa esta URL en el webhook de Twilio:
   ```
   https://xxxx-xx-xxx-xx.ngrok.io/api/webhooks/twilio
   ```

## Paso 7: Desplegar a Producción

1. Despliega tu proyecto a Vercel:
```bash
vercel deploy
```

2. Una vez desplegado, obtén tu URL de Vercel (ej: `https://citas-medicas.vercel.app`)

3. Actualiza el webhook en Twilio console:
   ```
   https://citas-medicas.vercel.app/api/webhooks/twilio
   ```

4. Configura las variables de entorno en Vercel:
   - Ve a Settings → Environment Variables en tu proyecto
   - Agrega:
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_WHATSAPP_NUMBER`

## Paso 8: Probar la Integración

1. Desde tu teléfono, abre WhatsApp
2. Envía un mensaje a tu número de WhatsApp Business (verificado en Twilio)
3. Debería aparecer automáticamente en tu CRM en la sección de Conversaciones
4. Puedes responder desde el CRM y el mensaje se enviará por WhatsApp

## Validación de Firma (Seguridad)

El webhook valida automáticamente que los mensajes provienen de Twilio usando:
- El **Auth Token** de Twilio
- La **firma X-Twilio-Signature**

Esto evita que mensajes falsos se procesen en tu aplicación.

## Solución de Problemas

### Los mensajes no aparecen en el CRM
1. Verifica que la URL del webhook esté correcta en Twilio
2. Abre la consola de Twilio y busca "Logs" → "Debugging" para ver errores
3. Verifica que la base de datos Supabase esté funcionando
4. Revisa la tabla `conversations` en tu base de datos

### Error "Webhook response failed"
- Verifica que tu servidor esté respondiendo correctamente
- El endpoint debe retornar un status 200 con XML válido
- Todos los errores deben capturarse y retornar 200 para evitar reintentos de Twilio

### Firma de Twilio no válida
- Verifica que `TWILIO_AUTH_TOKEN` sea exacto
- No cambies el Auth Token sin actualizar las variables de entorno

## Costo Estimado

- Twilio ofrece crédito gratis inicial ($15 USD)
- Costo por mensaje: ~$0.0075 USD por mensaje enviado/recibido
- La mayoría de planes son pay-as-you-go

Para más información, ve a https://www.twilio.com/pricing

## Soporte

- Documentación Twilio: https://www.twilio.com/docs/sms/whatsapp/api
- Twilio WhatsApp: https://www.twilio.com/docs/whatsapp
- Panel de control: https://console.twilio.com

## Notas Importantes

1. **Números de prueba**: Si usas un número en "Sandbox" (prueba), solo funcionará con números autorizados
2. **Aprobación de cuenta**: La aprobación de WhatsApp Business puede tomar 24-48 horas
3. **Límites**: El sandbox de WhatsApp tiene límite de 100 mensajes/día
4. **Producción**: Una vez aprobado, tienes acceso ilimitado

¡Listo! Tu integración de WhatsApp debería estar funcionando.
