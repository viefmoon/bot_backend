# 🚀 Inicio Rápido - Bot WhatsApp Local

## Requisitos Previos
1. **Docker** instalado
2. **Node.js 18+** instalado
3. **ngrok** (para WhatsApp real) - ver configuración abajo
4. **API Key de Google AI** (gratis en https://makersuite.google.com/app/apikey)
5. **Cuenta Meta Developer** con app WhatsApp Business configurada

## 🔧 Configuración Inicial (solo la primera vez)

### 1️⃣ Obtener Credenciales de WhatsApp

1. Ve a [Meta for Developers](https://developers.facebook.com)
2. Crea o selecciona tu app
3. En WhatsApp > API Setup, obtén:
   - `Phone number ID` (WHATSAPP_PHONE_NUMBER_MESSAGING_ID)
   - `WhatsApp Business Account ID`
   - `Permanent Access Token` (WHATSAPP_ACCESS_TOKEN)
4. Anota tu número de WhatsApp Business
5. **IMPORTANTE para desarrollo**: En la sección "To" o "Recipients", agrega tu número personal:
   - Click en "Add phone number" o "Manage phone number list"
   - Agrega el número desde el cual enviarás mensajes de prueba
   - Verifica con el código que recibirás por WhatsApp

### 2️⃣ Configurar Variables de Entorno

Edita `backend/.env.local` (NO `.env`) y actualiza:

```env
# Google AI - REQUERIDO
GOOGLE_AI_API_KEY=tu_api_key_real_aqui

# WhatsApp Business API - REQUERIDO
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=tu_phone_number_id
WHATSAPP_ACCESS_TOKEN=tu_access_token_permanente
WHATSAPP_VERIFY_TOKEN=un_token_secreto_que_tu_elijas
```

### 3️⃣ Configurar Ngrok

Ngrok ahora requiere autenticación (cuenta gratuita):

1. **Crea una cuenta** en https://dashboard.ngrok.com/signup
2. **Obtén tu authtoken** en https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configura ngrok** con tu token:
   ```bash
   ngrok config add-authtoken TU_TOKEN_AQUI
   ```

## 🚀 Iniciar el Bot

### 1️⃣ Iniciar Backend y Base de Datos
```bash
./start-dev.sh      # Linux/Mac
start-dev.bat       # Windows
```

Esto automáticamente:
- ✅ Inicia PostgreSQL con Docker
- ✅ Instala dependencias
- ✅ Crea las tablas y carga el menú
- ✅ Inicia el servidor en http://localhost:5000/backend

### 2️⃣ Exponer el Servidor con Ngrok

En otra terminal:
```bash
ngrok http 5000
```

Verás algo como:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5000
```

**IMPORTANTE**: 
- Copia la URL HTTPS (cambia cada vez que reinicias ngrok)
- Si no configuraste ngrok anteriormente, ver la sección 3️⃣ arriba

### 3️⃣ Configurar Webhook en Meta

1. Ve a tu app en [Meta for Developers](https://developers.facebook.com)
2. WhatsApp > Configuration > Webhook
3. Configura:
   - **Callback URL**: `https://abc123.ngrok-free.app/backend/webhook`
   - **Verify token**: El mismo que pusiste en WHATSAPP_VERIFY_TOKEN
4. Click en "Verify and save"
5. Suscríbete a los campos: `messages`

## ✅ ¡Listo para Probar!

1. **Envía un mensaje** a tu número de WhatsApp Business
2. **Verás los logs** en la terminal donde ejecutaste el script de inicio
3. **El bot responderá** directamente por WhatsApp

### Mensajes de Prueba:
- "Hola" - Saludo inicial
- "Quiero ver el menú" - Muestra el menú
- "Quiero 2 pizzas hawaianas grandes" - Inicia un pedido

## 🛠️ Comandos Útiles

```bash
# Ver y editar datos en la base de datos (en otra terminal)
cd backend && npx prisma studio
# Esto abre una interfaz web en http://localhost:5555

# Ver logs de Docker
docker compose logs -f

# Reiniciar todo
docker compose down && ./start-dev.sh  # O start-dev.bat en Windows
```

## 🛑 Para Detener Todo

1. `Ctrl+C` en la terminal del servidor
2. `Ctrl+C` en la terminal de ngrok
3. `docker-compose down` para detener PostgreSQL

## ⚠️ Solución de Problemas

### "Webhook no se verifica"
- Asegúrate que el verify token coincida exactamente
- La URL debe ser HTTPS (ngrok lo proporciona)
- El servidor debe estar corriendo antes de verificar

### "No recibo mensajes"
- Verifica que estés suscrito a "messages" en el webhook
- Revisa los logs del servidor
- En Meta > Webhooks > Recent errors

### "Error: Recipient phone number not in allowed list"
- Tu app está en modo desarrollo
- Ve a WhatsApp > API Setup > sección "To" o "Recipients"
- Agrega el número desde el cual envías mensajes
- Verifica con el código que recibes por WhatsApp

### "El bot no responde"
- Verifica que tengas tu Google AI API key configurada
- Revisa los logs para ver errores
- Asegúrate que el número que envía está en formato internacional

## 📝 Notas Importantes

- **Ngrok gratis**: La URL cambia cada vez, debes actualizar el webhook
- **Rate limits**: WhatsApp tiene límites de mensajes por minuto
- **Desarrollo**: Usa un número de prueba para no afectar el principal
- **Logs**: Todos los mensajes y respuestas aparecen en la terminal