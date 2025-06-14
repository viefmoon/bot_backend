# 🤖 Bot Backend - WhatsApp Restaurant Bot

Backend para un bot de WhatsApp para restaurante, usando Express, Prisma y PostgreSQL.

## 🚀 Inicio Rápido

Ver la guía completa en: **[QUICK_START.md](QUICK_START.md)**

### Resumen:
1. Configura credenciales de WhatsApp y Google AI
2. Ejecuta `./start-local.sh`
3. Usa ngrok para exponer el webhook
4. ¡Listo! El bot responde por WhatsApp

### Requisitos:
- Docker y Docker Compose
- Node.js 18+
- ngrok
- API Key de Google AI
- Cuenta Meta Developer con WhatsApp Business

## 📁 Estructura del Proyecto

```
backend/
├── prisma/
│   ├── schema.prisma    # Esquema de la base de datos
│   └── seed.ts          # Datos iniciales (menú)
├── src/
│   ├── config/          # Configuraciones y mensajes predefinidos
│   ├── services/        # Lógica de negocio
│   ├── utils/           # Utilidades y procesador de IA
│   ├── whatsapp/        # Handlers de WhatsApp
│   └── server.ts        # Servidor Express principal
└── .env.local           # Variables de entorno para desarrollo
```

## 🚀 Deploy en Railway

### 1. Preparar el Proyecto

Asegúrate de que todo funciona localmente primero.

### 2. Crear Proyecto en Railway

1. Ve a [Railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Agrega un servicio PostgreSQL
4. Agrega tu repositorio de GitHub

### 3. Configurar Variables de Entorno

En Railway, agrega estas variables:

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=tu_numero_id
WHATSAPP_ACCESS_TOKEN=tu_access_token
WHATSAPP_VERIFY_TOKEN=tu_verify_token
BOT_WHATSAPP_NUMBER=521234567890

# Google AI
GOOGLE_AI_API_KEY=tu_api_key

# URLs
FRONTEND_BASE_URL=https://tu-dominio.com

# Configuración del Restaurante
TIME_ZONE=America/Mexico_City
OPENING_HOURS_TUES_SAT=14:00
CLOSING_HOURS_TUES_SAT=22:00
OPENING_HOURS_SUN=14:00
CLOSING_HOURS_SUN=21:00
OPENING_GRACE_PERIOD_MINUTES=30
CLOSING_GRACE_PERIOD_MINUTES=30
ESTIMATED_PICKUP_TIME=20
ESTIMATED_DELIVERY_TIME=40
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5
```

### 4. Configurar el Build

En Railway, configura:
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm run migrate && npm run seed && npm start`

### 5. Deploy

Railway desplegará automáticamente cuando hagas push a tu repositorio.

## 🔧 Comandos Útiles

```bash
# Desarrollo local
npm run dev

# Generar cliente de Prisma
npm run generate

# Ejecutar migraciones
npm run migrate:dev

# Ver base de datos
npm run studio

# Ejecutar seed
npm run seed
```

## 📝 Notas Importantes

- El bot usa Google Gemini AI para procesar mensajes
- La base de datos PostgreSQL se configura automáticamente en Railway
- Los webhooks de WhatsApp deben apuntar a: `https://tu-app.railway.app/backend/webhook`
- El puerto 5433 se usa localmente para evitar conflictos con PostgreSQL existente
- Para probar con WhatsApp real en local, usa ngrok o similar