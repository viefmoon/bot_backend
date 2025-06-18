# Guía de Despliegue en Railway

Esta guía te ayudará a desplegar el backend del bot de WhatsApp y su base de datos PostgreSQL en Railway.

## Requisitos Previos

1. Cuenta en [Railway](https://railway.app)
2. Cuenta de GitHub con este repositorio
3. Credenciales de WhatsApp Business API
4. API Key de Google AI (Gemini) o OpenAI
5. Credenciales de Stripe (si usas pagos)

## Paso 1: Crear un Nuevo Proyecto en Railway

1. Inicia sesión en [Railway](https://railway.app)
2. Click en **"New Project"**
3. Selecciona **"Empty Project"**

## Paso 2: Agregar PostgreSQL

1. Dentro de tu proyecto, click en **"New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente la base de datos con todas las credenciales

## Paso 3: Desplegar el Backend

1. En el mismo proyecto, click en **"New"** → **"GitHub Repo"**
2. Autoriza Railway para acceder a tu GitHub si es necesario
3. Selecciona tu repositorio `bot_backend`
4. En la configuración del servicio:
   - **Root Directory**: `/backend`
   - **Start Command**: Se detectará automáticamente del `railway.json`

## Paso 4: Conectar la Base de Datos

1. Click en tu servicio de backend
2. Ve a la pestaña **"Variables"**
3. Click en **"Add Variable Reference"**
4. Selecciona **"DATABASE_URL"** del servicio PostgreSQL
5. Railway conectará automáticamente los servicios

## Paso 5: Configurar Variables de Entorno

En la pestaña **"Variables"** del servicio backend, agrega las siguientes variables:

### Variables Obligatorias

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=tu_phone_number_id
WHATSAPP_ACCESS_TOKEN=tu_token_de_meta
WHATSAPP_VERIFY_TOKEN=un_token_secreto_que_tu_elijas

# API de IA (elige una)
GOOGLE_AI_API_KEY=AIza...tu_api_key_de_gemini

# Entorno
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5
```

### Variables para Pagos (si las usas)

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Variables de URL (se actualizan después del deploy)

```env
NEXT_PUBLIC_BACKEND_BASE_URL=https://tu-servicio.railway.app
FRONTEND_BASE_URL=https://tu-frontend.railway.app
```

## Paso 6: Configurar el Dominio

1. Una vez desplegado, Railway te asignará un dominio automático
2. Ve a **"Settings"** → **"Networking"** → **"Generate Domain"**
3. Copia la URL generada (ejemplo: `https://bot-backend-production.up.railway.app`)
4. Actualiza la variable `NEXT_PUBLIC_BACKEND_BASE_URL` con esta URL

## Paso 7: Ejecutar Migraciones

Las migraciones se ejecutan automáticamente gracias al `railway.json`, pero si necesitas ejecutarlas manualmente:

1. Ve a la pestaña **"Deployments"**
2. Click en los tres puntos del deployment activo
3. Selecciona **"Run command"**
4. Ejecuta: `npm run migrate`

## Paso 8: Configurar Webhook en Meta

1. Ve a tu app en [Meta for Developers](https://developers.facebook.com)
2. En WhatsApp → Configuration → Webhook
3. Configura:
   - **Callback URL**: `https://tu-dominio-railway.app/backend/webhooks/whatsapp`
   - **Verify Token**: El mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
4. Suscríbete a los campos: `messages`, `messaging_postbacks`

## Paso 9: Verificar el Despliegue

1. Visita `https://tu-dominio-railway.app/backend` - Deberías ver un mensaje de bienvenida
2. Revisa los logs en Railway para asegurarte de que no hay errores
3. Envía un mensaje de prueba a tu número de WhatsApp Business

## Solución de Problemas

### Error de Conexión a Base de Datos

- Verifica que `DATABASE_URL` esté vinculada correctamente
- Los logs deberían mostrar: "Conexión a la base de datos establecida con éxito"

### Webhook no Responde

- Verifica que la URL del webhook sea correcta
- Asegúrate de que `WHATSAPP_VERIFY_TOKEN` coincida en Railway y Meta
- Revisa los logs para ver si llegan las peticiones

### Error 500 en las Peticiones

- Revisa que todas las variables de entorno obligatorias estén configuradas
- Verifica los logs del servicio en Railway
- Asegúrate de que las migraciones se ejecutaron correctamente

### El Bot no Responde

- Verifica que `GOOGLE_AI_API_KEY` sea válida
- Revisa que el número de WhatsApp esté en el formato correcto (con código de país)
- Verifica los logs para ver si se procesan los mensajes

## Comandos Útiles

Para ejecutar comandos en Railway:

```bash
# Ver logs en tiempo real
railway logs

# Ejecutar migraciones manualmente
railway run npm run migrate

# Ejecutar seeders
railway run npm run seed
```

## Monitoreo

1. **Logs**: Disponibles en la pestaña "Deployments" de cada servicio
2. **Métricas**: Railway muestra uso de CPU, memoria y red
3. **Base de Datos**: Puedes conectarte usando cualquier cliente PostgreSQL con las credenciales de Railway

## Costos

- Railway ofrece $5 USD gratis al mes
- PostgreSQL y el backend consumen aproximadamente $5-10 USD/mes en uso normal
- Monitorea tu uso en la sección "Usage" del proyecto

## Siguiente Paso

Una vez que el backend esté funcionando, puedes:
1. Configurar un dominio personalizado
2. Implementar CI/CD con GitHub Actions
3. Configurar backups automáticos de la base de datos
4. Agregar monitoreo con servicios externos

¿Necesitas ayuda con algún paso específico? ¡El bot ya debería estar funcionando!