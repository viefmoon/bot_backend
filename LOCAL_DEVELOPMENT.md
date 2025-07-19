# Guía de Desarrollo Local

## Script Automatizado (Recomendado)

La forma más fácil de iniciar el desarrollo local es usando el script automatizado:

```bash
./start-dev.sh      # Linux/Mac
start-dev.bat       # Windows
```

Este script:
- Inicia PostgreSQL con pgvector y Redis usando Docker
- Configura la base de datos y ejecuta migraciones
- Instala dependencias
- Genera embeddings automáticamente
- Inicia el backend y frontend

## Desarrollo Manual con Docker

Si prefieres configurar todo manualmente, sigue esta guía:

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
    image: pgvector/pgvector:pg15
    container_name: postgres_bot_backend
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bot_backend
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: redis_bot_backend
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
```

## Paso 3: Configurar Variables de Entorno

Crea el archivo `backend/.env.local` con tus valores:

```bash
cd backend
cp .env.example .env.local
```

Edita `backend/.env.local` con tus valores (ver QUICK_START.md para detalles)

## Paso 4: Iniciar los Servicios

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Instalar dependencias del backend
cd backend
npm install

# Ejecutar migraciones
npm run migrate:dev

# Ejecutar seed (datos iniciales)
npm run seed

# Iniciar el servidor de desarrollo
npm run dev
```

**Nota**: pgvector se configura automáticamente:
- La migración crea la extensión vector y la columna embedding
- Los embeddings se generan automáticamente al iniciar el servidor
- No se requieren pasos manuales adicionales

## Paso 5: Verificar que Todo Funciona

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
cd backend
npm run studio
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

# Ejecutar comandos del backend
cd backend
npm run migrate:dev
npm run seed
npm run studio

# Ver logs de Docker
docker-compose logs -f postgres
docker-compose logs -f redis
```

## Desarrollo con Hot Reload

El backend se ejecuta con `ts-node --transpile-only`, por lo que:
- Los cambios en el código se reflejan automáticamente
- No necesitas reiniciar el servidor
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

# O cambia el puerto en el archivo .env
PORT=5001
```

### Limpiar y empezar de nuevo
```bash
# Detener todo y eliminar volúmenes
docker-compose down -v

# Eliminar node_modules
rm -rf backend/node_modules

# Reiniciar Docker
docker-compose down
docker-compose up -d

# Reinstalar dependencias del backend
cd backend
npm install
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