# 🚀 Desplegar Bot de WhatsApp a Supabase

## Paso 1: Desplegar la Edge Function

```bash
# Inicia sesión en Supabase (solo la primera vez)
npx supabase login

# Despliega la función
npx supabase functions deploy whatsapp-webhook --project-ref TU_PROJECT_REF
```

**Nota:** Tu `PROJECT_REF` lo encuentras en el dashboard de Supabase en la URL del proyecto.

---

## Paso 2: Configurar Variables de Entorno

En el dashboard de Supabase:

1. Ve a **Settings > Edge Functions > Environment Variables**
2. Agrega estas variables:

```
WHATSAPP_PHONE_ID=tu_phone_id
WHATSAPP_ACCESS_TOKEN=tu_access_token
WHATSAPP_VERIFY_TOKEN=tu_verify_token (el mismo que usarás en Meta)
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

---

## Paso 3: Actualizar Webhook en Meta

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu app de WhatsApp
3. **WhatsApp > Configuration**
4. En "Webhook", cambia la URL a:

```
https://TU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook
```

5. **Verify Token**: El mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
6. Click **"Verify and Save"**
7. Marca **"messages"** en Webhook fields

---

## Paso 4: Probar el Bot

Envía mensajes a tu número de WhatsApp:
- "hola"
- "/menu"
- "/ayuda"
- "/horarios"

¡El bot debe responder con las nuevas funcionalidades! 🎉

---

## 🔍 Ver logs (debugging)

```bash
npx supabase functions logs whatsapp-webhook --project-ref TU_PROJECT_REF
```

O en el dashboard: **Edge Functions > whatsapp-webhook > Logs**
