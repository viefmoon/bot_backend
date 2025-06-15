# Guía de Desarrollo Local con Docker

Esta guía te ayudará a ejecutar el backend del bot de WhatsApp en tu máquina local usando Docker.

## Requisitos Previos

- Docker y Docker Compose instalados
- Git
- Node.js 18+ (para ejecutar comandos npm)
- Una API Key de Google AI (Gemini)

## Paso 1: Clonar el Repositorio

```bash
git clone <tu-repositorio>
cd bot_backend
```

## Paso 2: Crear Docker Compose

Crea un archivo `docker-compose.yml` en la raíz del proyecto:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: bot_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
      POSTGRES_DB: bot_restaurant_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: bot_backend
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres123@postgres:5432/bot_restaurant_db
      NODE_ENV: development
      PORT: 5000
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
```

## Paso 3: Crear Dockerfile para el Backend

Crea el archivo `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci

# Copiar prisma schema
COPY prisma ./prisma

# Generar Prisma Client
RUN npx prisma generate

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 5000

# Comando por defecto
CMD ["npm", "run", "dev"]
```

## Paso 4: Configurar Variables de Entorno

Crea el archivo `backend/.env` basado en `.env.example`:

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` con tus valores:

```env
# Base de datos (Docker Compose la configura automáticamente)
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/bot_restaurant_db

# WhatsApp Business API (usa valores de prueba para desarrollo)
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=123456789
WHATSAPP_ACCESS_TOKEN=desarrollo_token_123
WHATSAPP_VERIFY_TOKEN=mi_token_verificacion_local
BOT_WHATSAPP_NUMBER=521234567890

# API de IA - NECESITAS UNA REAL
GOOGLE_AI_API_KEY=AIza... # Obtén una en https://makersuite.google.com/app/apikey

# Stripe (opcional para desarrollo)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Configuración de URLs
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:5000
FRONTEND_BASE_URL=http://localhost:3000

# Configuración del Restaurante
TIME_ZONE=America/Mexico_City
OPENING_HOURS_TUES_SAT=14:00
CLOSING_HOURS_TUES_SAT=22:00
OPENING_HOURS_SUN=14:00
CLOSING_HOURS_SUN=21:00

# Períodos de gracia
OPENING_GRACE_PERIOD_MINUTES=30
CLOSING_GRACE_PERIOD_MINUTES=30

# Tiempos estimados
ESTIMATED_PICKUP_TIME=20
ESTIMATED_DELIVERY_TIME=40

# Rate Limiting
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5

# Entorno
NODE_ENV=development
```

## Paso 5: Iniciar los Servicios

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Ver logs
docker-compose logs -f

# Ver solo logs del backend
docker-compose logs -f backend
```

## Paso 6: Ejecutar Migraciones y Seed

```bash
# Ejecutar migraciones
docker-compose exec backend npx prisma migrate dev

# Ejecutar seed (datos iniciales)
docker-compose exec backend npm run seed
```

## Paso 7: Verificar que Todo Funciona

### 1. Health Check
```bash
curl http://localhost:5000/backend
```

Deberías ver:
```json
{
  "message": "Bot Backend API is running",
  "version": "2.0.0",
  "timestamp": "2024-01-15T..."
}
```

### 2. Prisma Studio (Visualizar Base de Datos)
```bash
docker-compose exec backend npx prisma studio
```
Abre http://localhost:5555 en tu navegador

### 3. Probar Webhook
```bash
# Verificación GET
curl "http://localhost:5000/backend/webhook?hub.mode=subscribe&hub.verify_token=mi_token_verificacion_local&hub.challenge=test123"
```

### 4. Simular Mensaje de WhatsApp
```bash
curl -X POST http://localhost:5000/backend/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "id": "ENTRY_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "123456789"
          },
          "messages": [{
            "from": "521234567890",
            "id": "MESSAGE_ID",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Hola, quiero ver el menú"
            }
          }]
        }
      }]
    }]
  }'
```

## Comandos Útiles de Docker

```bash
# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (BORRA LA BD)
docker-compose down -v

# Reconstruir imagen del backend
docker-compose build backend

# Ejecutar comandos en el contenedor
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
docker-compose exec backend npm run studio

# Ver logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Reiniciar un servicio
docker-compose restart backend
```

## Desarrollo con Hot Reload

El backend está configurado con `ts-node` en modo watch, por lo que:
- Los cambios en el código se reflejan automáticamente
- No necesitas reiniciar el contenedor
- Solo guarda los archivos y el servidor se recargará

## Solución de Problemas

### Error: "Cannot connect to database"
```bash
# Verifica que PostgreSQL esté corriendo
docker-compose ps

# Revisa los logs de PostgreSQL
docker-compose logs postgres
```

### Error: "Google AI API key not valid"
- Asegúrate de tener una API key válida de Google AI
- Obtén una en: https://makersuite.google.com/app/apikey

### Error: "Port 5000 already in use"
```bash
# Encuentra qué proceso usa el puerto
lsof -i :5000

# O cambia el puerto en docker-compose.yml
ports:
  - "5001:5000"
```

### Limpiar y empezar de nuevo
```bash
# Detener todo y eliminar volúmenes
docker-compose down -v

# Eliminar node_modules
rm -rf backend/node_modules

# Reconstruir todo
docker-compose build --no-cache
docker-compose up -d
```

## Testing Local

### Script de Pruebas Automatizadas

Crea `test-local.sh`:

```bash
#!/bin/bash

echo "🧪 Ejecutando pruebas del backend..."

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# URL base
BASE_URL="http://localhost:5000/backend"

# 1. Health check
echo -e "\n1. Health Check:"
response=$(curl -s -w "\n%{http_code}" $BASE_URL)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Health check pasó${NC}"
    echo "$body" | jq '.'
else
    echo -e "${RED}✗ Health check falló (HTTP $http_code)${NC}"
fi

# 2. Webhook verification
echo -e "\n2. Verificación de Webhook:"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/webhook?hub.mode=subscribe&hub.verify_token=mi_token_verificacion_local&hub.challenge=test123")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ] && [ "$body" == "test123" ]; then
    echo -e "${GREEN}✓ Verificación de webhook pasó${NC}"
else
    echo -e "${RED}✗ Verificación de webhook falló${NC}"
fi

# 3. Test OTP
echo -e "\n3. Test de OTP:"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"customerId":"test123","otp":"123456"}')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Endpoint OTP funcionando${NC}"
else
    echo -e "${RED}✗ Endpoint OTP falló${NC}"
fi

echo -e "\n✅ Pruebas completadas"
```

Hazlo ejecutable:
```bash
chmod +x test-local.sh
./test-local.sh
```

## Integración con ngrok (para webhooks reales)

Si quieres probar con webhooks reales de WhatsApp:

```bash
# Instalar ngrok
brew install ngrok  # macOS
# o descarga de https://ngrok.com

# Exponer tu backend local
ngrok http 5000

# Obtendrás una URL como: https://abc123.ngrok.io
# Usa esta URL en Meta Developers como webhook:
# https://abc123.ngrok.io/backend/webhook
```

## Próximos Pasos

1. **Desarrollo**: Modifica el código en `backend/src`
2. **Pruebas**: Usa los scripts de prueba
3. **Depuración**: Revisa logs con `docker-compose logs -f backend`
4. **Base de datos**: Usa Prisma Studio para ver/editar datos
5. **Deployment**: Cuando estés listo, despliega a Railway

¡Feliz desarrollo! 🚀