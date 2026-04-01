# 🤖 Guía Completa de Configuración del Chatbot

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Panel](#acceso-al-panel)
3. [Crear Configuración](#crear-configuración)
4. [Tipos de Triggers](#tipos-de-triggers)
5. [Tipos de Acciones](#tipos-de-acciones)
6. [Ejemplos Prácticos](#ejemplos-prácticos)
7. [Variables Dinámicas](#variables-dinámicas)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

El panel de chatbot te permite crear flujos automáticos que el agente ejecuta cuando recibe mensajes en WhatsApp. Sin necesidad de código, configuras pasos secuenciales con acciones que se disparan según ciertos triggers.

**Características:**
- ✅ Pasos configurables sin código
- ✅ Múltiples tipos de triggers
- ✅ Acciones automáticas personalizables
- ✅ Vista previa del flujo
- ✅ Historial de ejecuciones
- ✅ Variables dinámicas personalizadas

---

## Acceso al Panel

### Ubicación
```
Dashboard → Chatbot (solo Admin)
```

### URL Directa
```
https://tu-dominio.com/dashboard/admin/chatbot
```

### Requisitos
- Ser administrador de la clínica
- Base de datos configurada
- WhatsApp conectado a Twilio

---

## Crear Configuración

### Paso 1: Nueva Configuración

1. Click en **"Nuevo Chatbot"**
2. Completa el formulario:

| Campo | Obligatorio | Descripción |
|-------|-----------|-------------|
| **Nombre** | ✅ | Identificador único (Ej: "Chatbot de Citas") |
| **Descripción** | ❌ | Propósito del chatbot |
| **Mensaje de Bienvenida** | ❌ | Se envía cuando inicia el chat |
| **Mensaje por Defecto** | ✅ | Si no entiende la solicitud |
| **Mensaje de Escalación** | ✅ | Cuando se deriva a un agente |
| **Reintentos Máximos** | ✅ | Intentos antes de escalar (1-10) |
| **Estado** | ✅ | Activo/Inactivo |

### Ejemplo:
```
Nombre: Chatbot Citas
Descripción: Automatiza solicitudes de citas y consultas
Bienvenida: "Hola 👋 Bienvenido a nuestra clínica. ¿En qué puedo ayudarte?"
Por Defecto: "Lo siento, no entiendo. ¿Puedes ser más específico?"
Escalación: "Conectándote con un agente..."
Reintentos: 3
```

---

## Tipos de Triggers

Los triggers definen **cuándo** se ejecuta un paso.

### 1. **Mensaje Recibido** ⚡
Se ejecuta automáticamente cuando llega cualquier mensaje.

**Casos de uso:**
- Saludo inicial
- Respuesta automática inmediata
- Recopilación de información

### 2. **Palabra Clave** 🔑
Se ejecuta cuando el usuario escribe palabras específicas.

**Ejemplo:**
```
Palabras clave: "cita", "agendar", "reservar"

Usuario: "Quiero una cita"
✅ Se ejecuta

Usuario: "Hola"
❌ No se ejecuta
```

**Casos de uso:**
- Direccionar según intención del usuario
- Palabras específicas para servicios
- Preguntas frecuentes por palabra clave

### 3. **Tiene Cita Pendiente** 📅
Solo se ejecuta si el paciente tiene una cita sin confirmar.

**Casos de uso:**
- Recordar citas pendientes
- Pedir confirmación
- Actualizar estado

### 4. **Paciente Nuevo** 👤
Se ejecuta solo para nuevos pacientes.

**Casos de uso:**
- Bienvenida especial
- Solicitar información inicial
- Referirse a política de cancelación

### 5. **Después de Retardo** ⏱️
Se ejecuta después de X minutos sin respuesta.

**Ejemplo:**
```
Retardo: 5 minutos

[Usuario escribe]
↓
[5 minutos sin respuesta]
✅ Ejecutar paso

Casos de uso:
- Recordatorios automáticos
- Mensajes de seguimiento
- Escalación después de espera
```

---

## Tipos de Acciones

Las acciones definen **qué hace** el chatbot cuando se ejecuta un paso.

### 1. **Enviar Mensaje** 💬
Envía un mensaje automático al usuario.

**Configuración:**
- Plantilla de mensaje (soporta variables)
- Retardo opcional

**Ejemplo:**
```
"Hola {{nombre}}, gracias por contactarnos. 
¿Qué especialidad te interesa? 
Disponemos de: Cardiology, Odontología, Dermatología"
```

### 2. **Crear Solicitud de Cita** 📋
Crea automáticamente una solicitud de cita.

**Configuración:**
- Especialidad requerida
- Se vincula al paciente automáticamente

**Ejemplo:**
```
Usuario: "Necesito una cita con cardiólogo"
✅ Crea solicitud en Cardiology
✅ Estado: "nueva"
✅ Vinculada a la conversación
```

### 3. **Recopilar Información** 📝
Solicita un dato específico y lo guarda.

**Configuración:**
- Campo (email, phone, nombre, etc)
- Etiqueta a mostrar
- Se almacena en el contexto del usuario

**Ejemplo:**
```
Etiqueta: "¿Cuál es tu email?"
Campo: email
Result: {{email}} = "usuario@example.com"
```

### 4. **Enviar Recordatorio** 🔔
Envía un recordatorio personalizado.

**Casos de uso:**
- Recordar citas próximas
- Confirmación de horarios
- Recordatorio de medicinas

### 5. **Derivar a Agente** 👨‍💼
Escala a un agente humano.

**Configuración:**
- Mensaje de escalación automático
- Marca conversación como "en atención"
- El agente recibe notificación

### 6. **Actualizar Estado Conversación** 🔄
Cambia el estado de la conversación.

**Valores:**
- Nueva
- En Atención
- Cerrada

---

## Ejemplos Prácticos

### Ejemplo 1: Chatbot de Bienvenida y Citas

#### Paso 1: Saludo Inicial
- **Trigger:** Mensaje Recibido
- **Acción 1:** Enviar Mensaje
  ```
  "Hola {{nombre}} 👋

  Bienvenido a nuestra clínica.

  ¿Qué necesitas?
  - Agendar cita (escribe 'cita')
  - Información de horarios (escribe 'horarios')
  - Hablar con un agente (escribe 'agente')
  "
  ```

#### Paso 2: Procesar Palabra "cita"
- **Trigger:** Palabra Clave → "cita"
- **Acción 1:** Recopilar Información
  - Campo: specialty_preference
  - Etiqueta: "¿Qué especialidad necesitas?"
- **Acción 2 (Retardo 5s):** Crear Solicitud de Cita
  - Especialidad: La recopilada
- **Acción 3:** Enviar Mensaje
  - "✅ Tu solicitud está siendo procesada. Un agente te contactará pronto."

#### Paso 3: Procesar Palabra "agente"
- **Trigger:** Palabra Clave → "agente"
- **Acción 1:** Derivar a Agente
  - Mensaje: "Te estoy conectando con un agente..."

---

### Ejemplo 2: Recordatorio de Cita Pendiente

#### Paso 1: Verificar Cita
- **Trigger:** Mensaje Recibido
- **Condición:** Tiene cita pendiente
- **Acción 1:** Enviar Mensaje
  ```
  "Recordatorio: Tienes una cita el {{fecha_cita}} 
  a las {{hora_cita}} con {{doctor_name}}.

  ¿Confirmamos la asistencia? 
  (escribe 'sí' o 'no')
  "
  ```

#### Paso 2: Procesar Confirmación
- **Trigger:** Palabra Clave → "sí"
- **Acción 1:** Actualizar Estado Conversación
  - Nuevo estado: "cerrada"
- **Acción 2:** Enviar Mensaje
  - "✅ Cita confirmada. ¡Nos vemos el {{fecha_cita}}!"

---

### Ejemplo 3: Seguimiento Automático

#### Paso 1: Mensaje Inicial
- **Trigger:** Mensaje Recibido
- **Acción 1:** Enviar Mensaje
  - "Gracias por tu mensaje. Un agente te responderá en breve."

#### Paso 2: Seguimiento si No Responden
- **Trigger:** Después de Retardo (15 minutos)
- **Acción 1:** Enviar Mensaje
  ```
  "¿Sigues ahí? Nuestro equipo está disponible.
  Escribe tu consulta o marca 'agente' para hablar directamente."
  ```

#### Paso 3: Escalación Final
- **Trigger:** Después de Retardo (30 minutos)
- **Acción 1:** Derivar a Agente
  - Prioridad automática a agentes disponibles

---

## Variables Dinámicas

Usa variables para personalizar mensajes. Se cargan automáticamente del perfil del usuario.

### Variables Disponibles

| Variable | Fuente | Ejemplo |
|----------|--------|---------|
| `{{nombre}}` | Perfil paciente | "Juan" |
| `{{email}}` | Perfil paciente | "juan@email.com" |
| `{{telefono}}` | Conversación | "+5799999999" |
| `{{fecha_cita}}` | Próxima cita | "2026-04-15" |
| `{{hora_cita}}` | Próxima cita | "14:30" |
| `{{doctor_name}}` | Cita | "Dr. Carlos López" |
| `{{especialidad}}` | Cita | "Cardiología" |
| `{{eps}}` | Perfil paciente | "Saludvida" |

### Cómo Usarlas

```
"Hola {{nombre}}, tu cita con {{doctor_name}} 
es el {{fecha_cita}} a las {{hora_cita}}. 
Tu EPS es {{eps}}."
```

### Resultado
```
"Hola Juan, tu cita con Dr. Carlos López 
es el 2026-04-15 a las 14:30. 
Tu EPS es Saludvida."
```

---

## Mejores Prácticas

### ✅ DO's

1. **Mantén mensajes cortos**
   - Máximo 2-3 oraciones
   - Emojis para claridad
   - Lenguaje natural

2. **Sé específico con triggers**
   - Usa palabras clave exactas
   - Prueba con casos reales
   - Agrupa palabras similares

3. **Ordena pasos lógicamente**
   - Saludo → Recopilación → Acción
   - Sigue el flujo natural
   - Escalada al final si es necesario

4. **Usa retardos estratégicamente**
   - 3-5s entre acciones
   - 10-15min para seguimientos
   - Evita bombardear al usuario

5. **Prueba en producción**
   - Envía mensajes de prueba
   - Revisa la vista previa
   - Monitora logs de ejecución

### ❌ DON'Ts

1. ❌ No hagas pasos sin acciones
2. ❌ No repitas triggers en múltiples pasos
3. ❌ No uses mensajes genéricos impersonales
4. ❌ No escales a agente sin intentar ayudar
5. ❌ No crees loops infinitos de mensajes

---

## Solución de Problemas

### El chatbot no se ejecuta

**Causas posibles:**
1. Chatbot desactivado → Actívalo en la lista
2. Trigger no coincide → Revisa palabras clave exactas
3. Condición no se cumple → Verifica cita pendiente
4. Conversación no vinculada → Sincroniza desde Twilio

**Solución:**
```
1. Dashboard → Chatbot
2. Haz click en ⚡ Vista Previa
3. Revisa los triggers y condiciones
4. Activa/desactiva según sea necesario
```

### Mensajes con variables vacías

**Ejemplo:**
```
"Hola , tu cita es el ..."  ← {{nombre}} vacío
```

**Causas:**
1. Paciente no está en el sistema
2. Variable no existe
3. Campo en BD está vacío

**Solución:**
1. Crea el paciente manualmente
2. Usa variables que existan
3. Usa mensajes condicionales

### La acción no se ejecuta

**Revisar:**
1. ¿Está el paso activado?
2. ¿Está la acción activada?
3. ¿Tiene retardo muy largo?
4. ¿Hay conexión a Twilio?

**Debug:**
```
1. Abre Console → Network
2. Verifica requests a /api/chatbot/
3. Revisa response status (200 = OK)
4. Checa logs de ejecución
```

### Demasiados mensajes al usuario

**Soluciones:**
1. Aumenta retardos entre acciones (5s mínimo)
2. Combina acciones en un solo mensaje
3. Reduce pasos innecesarios
4. Escala a agente más rápido

---

## Monitoreo y Logs

### Acceder a Logs

```
Dashboard → Admin → Conversaciones
↓
Selecciona una conversación
↓
Ver historial de ejecuciones del chatbot
```

### Información en Logs

```
{
  "timestamp": "2026-04-15T14:30:00Z",
  "trigger": "keyword",
  "trigger_value": "cita",
  "action": "send_message",
  "message": "¿Cuál especialidad?",
  "success": true,
  "duration_ms": 245
}
```

### Qué Buscar

✅ **Success: true** → Acción completada
❌ **Success: false** → Error (revisa error_message)
⏱️ **Duration** → Tiempos de ejecución
📊 **Frecuencia** → Pasos más usados

---

## API Reference

### Endpoints Disponibles

```bash
# Obtener configuraciones
GET /api/chatbot

# Crear configuración
POST /api/chatbot
Body: { name, description, welcome_message, ... }

# Obtener pasos
GET /api/chatbot/[id]/steps

# Crear paso
POST /api/chatbot/[id]/steps
Body: { name, trigger_type, ... }

# Crear acción
POST /api/chatbot/steps/[stepId]/actions
Body: { action_type, message_template, ... }
```

---

## FAQ

**P: ¿Cuántos pasos puedo tener?**
R: Ilimitados, pero se recomiendan máximo 10 para claridad

**P: ¿Puedo cambiar el orden de pasos?**
R: Sí, usa drag & drop (próxima versión) o reordena manualmente

**P: ¿Se pueden combinar triggers?**
R: No actualmente, usa palabras clave múltiples

**P: ¿Los mensajes se guardan en BD?**
R: Sí, en conversation_messages con tipo "staff"

**P: ¿Puedo crear variables personalizadas?**
R: Sí, se guardan en chatbot_user_context

**P: ¿Cómo testeo sin usar WhatsApp real?**
R: Usa la Vista Previa del flujo

---

## Recursos

- 📖 [Documentación de Twilio](https://www.twilio.com/docs)
- 📱 [WhatsApp API](https://www.twilio.com/whatsapp)
- 🔧 [API Interna](/IMPLEMENTATION_SUMMARY.md)

---

**Última actualización:** Marzo 2026  
**Versión:** 1.0  
**Soporte:** admin@clínica.com
