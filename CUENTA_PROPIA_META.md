Aquí están los pasos exactos para migrar del Sandbox a un número propio aprobado:

Requisitos previos
Cuenta Twilio con facturación activa (no trial/gratis)
Un número de teléfono que no esté registrado en WhatsApp personal
Acceso a recibir SMS o llamada en ese número (para verificación)
Nombre legal del negocio y datos de la empresa
Paso 1 — Crear cuenta de WhatsApp Business en Meta
Ve a Meta Business Suite: business.facebook.com
Crea una cuenta de negocio si no tienes una (Business Portfolio)
Completa la información del negocio:
Nombre legal de la empresa
Dirección
Sitio web
Categoría del negocio (Salud / Clínica médica)
Verificar el negocio: Ve a Business Settings → Security Center → Start Verification
Sube documentos (RUT, cámara de comercio, factura de servicios, etc.)
Meta tarda 1-5 días hábiles en verificar
La verificación de Meta Business es obligatoria para producción.

Paso 2 — Solicitar WhatsApp Sender en Twilio
Ve a Twilio Console → Messaging → WhatsApp → Senders
Clic en "New WhatsApp Sender"
Selecciona "Connect your WhatsApp Business Account"
Se abrirá el flujo de Facebook Embedded Signup:
Vincula tu Meta Business Account (del Paso 1)
Selecciona o crea un WhatsApp Business Profile
Ingresa el número de teléfono que quieres usar
Recibirás un código de verificación por SMS o llamada en ese número → ingrésalo
Twilio registrará el número. Estado inicial: "Pending" → pasará a "Ready" en minutos/horas
Paso 3 — Vincular el número al Conversations Service
Ve a Twilio Console → Conversations → Services → tu Service (el IS...)
Ve a Messaging Integration (o Defaults)
En "Handle Inbound Messages with Conversations": activa para tu nuevo número
Alternativamente, configura un Address Configuration:
Ve a Conversations → Address Configurations
Crea una nueva:
Type: WhatsApp
Address: whatsapp:+TU_NUMERO
Conversations Service SID: tu IS... existente
Autocreate Conversations: Enabled
Paso 4 — Configurar Webhooks del Service
Verifica que estos persisten (ya los tienes del sandbox):

Conversations → Services → Tu Service → Webhooks
Post-Event URL: https://tu-dominio.com/api/webhooks/twilio
Eventos habilitados:
✅ onMessageAdded
✅ onDeliveryUpdated ← este dispara los chulitos azules
Paso 5 — Habilitar Read Status en el Service
Conversations → Services → Tu Service → Settings
Busca "Read Status" → Enabled
Sin esto, Twilio no propaga read receipts aunque el código sea correcto
Paso 6 — Actualizar variable de entorno
Cambia en tu .env.local (y en Vercel si está desplegado):

No necesitas cambiar ningún otro código. Todo lo que implementamos ya usa esta variable.

Paso 7 — Crear Message Templates (obligatorio)
WhatsApp Business requiere plantillas aprobadas para iniciar conversaciones (mensajes salientes cuando han pasado más de 24h desde el último mensaje del paciente):

Ve a Twilio Console → Messaging → Content Template Builder
Crea plantillas para tus casos de uso, por ejemplo:
Recordatorio de cita: "Hola {{1}}, le recordamos su cita el {{2}} a las {{3}}"
Bienvenida: "Bienvenido a [Clínica]. ¿En qué podemos ayudarle?"
Envía para aprobación de Meta (1-24 horas)
Dentro de la ventana de 24h (después de que el paciente escribe), puedes enviar mensajes libres sin plantilla — que es el flujo normal de tu chatbot y respuestas de staff.

Paso 8 — Probar chulitos azules
Desde el teléfono del paciente, envía un mensaje a tu nuevo número de WhatsApp Business
Abre la conversación en tu CRM web
En la terminal deberías ver:
En el móvil del paciente → chulitos azules ✓✓ deberían aparecer
Resumen de tiempos estimados
Paso	Tiempo
Verificación de Meta Business	1-5 días
Registro de número en Twilio	Minutos - 1 hora
Address Configuration	Inmediato
Aprobación de Message Templates	1-24 horas
Total	2-6 días (el cuello de botella es Meta Business Verification)
Tu código ya está listo. Cuando el número esté aprobado, solo cambias TWILIO_WHATSAPP_NUMBER y todo funciona.