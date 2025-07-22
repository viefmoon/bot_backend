# 🤖 Bot Backend - WhatsApp Restaurant Bot

Backend para un bot de WhatsApp para restaurante, usando Express, Prisma y PostgreSQL.

## 🚀 Inicio Rápido

Ver la guía completa en: **[QUICK_START.md](QUICK_START.md)**

### Resumen:
1. Configura credenciales de WhatsApp y Google AI
2. Ejecuta `./start-dev.sh` (Linux/Mac) o `start-dev.bat` (Windows)
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

# Google AI
GOOGLE_AI_API_KEY=tu_api_key

# URLs
FRONTEND_BASE_URL=https://tu-dominio.com

# Límites de mensajes
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5

# Stripe (opcional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 4. Configurar el Build

En Railway, configura:
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm run migrate && npm run seed && npm start`

### 5. Deploy

Railway desplegará automáticamente cuando hagas push a tu repositorio.

## 🔧 Scripts de Desarrollo

### Scripts Principales

```bash
# Iniciar todo (backend + frontend + PostgreSQL)
./start-dev.sh      # Linux/Mac
start-dev.bat       # Windows

# Iniciar solo el frontend (requiere backend corriendo)
./start-frontend.sh

# Desarrollo completo con hot-reload (backend + frontend)
./dev.sh

# Solo backend
./dev-backend.sh

# Solo frontend
./dev-frontend.sh
```

### Comandos NPM

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

## 🚀 Optimización de Rendimiento

### Configuración de Workers

```env
# Número de trabajos concurrentes por worker
BULLMQ_WORKER_CONCURRENCY=10  # Desarrollo: 2-5, Producción: 10-20

# Número de procesos worker (PM2)
NUM_WORKERS=4  # Desarrollo: 1, Producción: 2-4 según CPU
```

### Pool de Conexiones de Base de Datos

Prisma gestiona automáticamente el pool de conexiones. Para optimizar:

```env
# Agregar parámetros a DATABASE_URL
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20

# connection_limit: Número máximo de conexiones (default: num_cpus * 2 + 1)
# pool_timeout: Tiempo de espera para obtener conexión (segundos)
```

### Configuración de Redis (Opcional)

```env
# Redis mejora rendimiento para OTP y caché
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=tu_password  # Opcional
```

### Límites de Rate Limiting

```env
# Ajustar según carga esperada
RATE_LIMIT_MAX_MESSAGES=30  # Máximo de mensajes
RATE_LIMIT_TIME_WINDOW_MINUTES=5  # Ventana de tiempo
```

### Producción con PM2

```bash
# Configurar workers en .env
BULLMQ_WORKER_CONCURRENCY=10
NUM_WORKERS=4

# Iniciar con PM2
npm run pm2:start

# Monitorear
npm run pm2:monit
```

### Métricas de Rendimiento

- **Tiempo de respuesta promedio**: < 2 segundos
- **Procesamiento concurrente**: Hasta 40 mensajes simultáneos (4 workers × 10 jobs)
- **Historial relevante**: Últimos 30 mensajes por usuario
- **TTL de caché**: 2 minutos para configuración del restaurante

## 📝 Notas Importantes

- El bot usa Google Gemini AI para procesar mensajes
- La base de datos PostgreSQL se configura automáticamente en Railway
- Los webhooks de WhatsApp deben apuntar a: `https://tu-app.railway.app/backend/webhook`
- El puerto 5433 se usa localmente para evitar conflictos con PostgreSQL existente
- Para probar con WhatsApp real en local, usa ngrok o similar
- Los mensajes se procesan secuencialmente por usuario para mantener el contexto