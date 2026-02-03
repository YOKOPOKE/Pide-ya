# 🔧 Resolver Error de Verificación del Webhook

## ❌ Error: "No se ha podido validar la URL de devolución de llamada"

Este error tiene **3 causas principales**:

---

## ✅ Solución 1: Verificar que WHATSAPP_VERIFY_TOKEN esté configurado

1. Ve al **Dashboard de Supabase**: https://supabase.com/dashboard/project/xsolxbroqqjkoseksmny/settings/functions
2. Busca **"WHATSAPP_VERIFY_TOKEN"** en los secrets
3. Si **NO está**, agrégalo:
   - **Nombre:** `WHATSAPP_VERIFY_TOKEN`
   - **Valor:** Un string cualquiera (ejemplo: `yokopoke_2026`)
   - **IMPORTANTE:** Recuerda este valor exacto

4. **Redeploy la función** para que tome el nuevo secret:
   ```bash
   npx supabase functions deploy whatsapp-webhook
   ```

---

## ✅ Solución 2: Verificar la URL exacta

La URL del webhook debe ser **exactamente**:
```
https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook
```

**NO debe tener**:
- ❌ Espacios
- ❌ Caracteres extra
- ❌ HTTPS incorrecto
- ❌ `/v1/` faltante

---

## ✅ Solución 3: El Verify Token debe coincidir EXACTAMENTE

En Meta/Facebook:
1. **Verify Token:** Debe ser **EXACTAMENTE** el mismo que pusiste en Supabase
2. **Case-sensitive:** `YokoPoke_2026` ≠ `yokopoke_2026`
3. Sin espacios al inicio o final

---

## 🧪 Probar manualmente

Para verificar que la función responde correctamente, abre esta URL en tu navegador:

```
https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=test123
```

Reemplaza `TU_TOKEN` con el valor que pusiste en `WHATSAPP_VERIFY_TOKEN`.

**Resultado esperado:**
- ✅ Si funciona: Debe devolver **"test123"**
- ❌ Si falla: Verifica el token

---

## 📋 Checklist de Verificación

Confirma que:
- [ ] `WHATSAPP_VERIFY_TOKEN` está en los secrets de Supabase
- [ ] Hiciste redeploy después de agregar el secret
- [ ] La URL en Meta es exactamente: `https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook`
- [ ] El Verify Token en Meta coincide EXACTAMENTE con el de Supabase
- [ ] La función está desplegada (VERSION 2 o mayor)

---

## 🔍 Ver errores en tiempo real

Para ver qué está pasando:

1. Ve a: https://supabase.com/dashboard/project/xsolxbroqqjkoseksmny/functions/whatsapp-webhook/details
2. Click en la pestaña **"Logs"**
3. Intenta verificar el webhook en Meta otra vez
4. Los logs te dirán qué está fallando

---

**¿Cuál es el valor que pusiste para `WHATSAPP_VERIFY_TOKEN`?** Te ayudo a verificar que todo coincida.
