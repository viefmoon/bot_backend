#!/bin/bash

echo "🚀 Iniciando backend localmente..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para matar proceso en un puerto
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Puerto $port en uso por proceso $pid. Liberando puerto...${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Limpiar puertos antes de iniciar
echo -e "\n${YELLOW}0. Limpiando puertos...${NC}"
kill_port 3000  # Frontend
kill_port 5000  # Backend
kill_port 5433  # PostgreSQL

# Verificar si el puerto 5433 está en uso después de la limpieza
if lsof -Pi :5433 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  El puerto 5433 aún está en uso. Intentando detener contenedores previos...${NC}"
    docker compose down
    sleep 2
fi

# Paso 1: Iniciar PostgreSQL y Redis con Docker
echo -e "\n${YELLOW}1. Iniciando PostgreSQL y Redis...${NC}"
docker compose up -d

# Esperar a que PostgreSQL esté listo
echo -e "${YELLOW}   Esperando a que PostgreSQL esté listo...${NC}"
max_attempts=30
attempt=0
until docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 || [ $attempt -eq $max_attempts ]; do
    attempt=$((attempt + 1))
    printf "\r   Esperando... intento $attempt/$max_attempts"
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${RED}❌ PostgreSQL no pudo iniciar después de $max_attempts intentos${NC}"
    echo "   Intenta ejecutar: docker compose logs postgres"
    exit 1
fi
echo -e "\n${GREEN}   ✅ PostgreSQL está listo!${NC}"

# Esperar a que Redis esté listo
echo -e "${YELLOW}   Esperando a que Redis esté listo...${NC}"
max_attempts=15
attempt=0
until docker compose exec -T redis redis-cli ping >/dev/null 2>&1 || [ $attempt -eq $max_attempts ]; do
    attempt=$((attempt + 1))
    printf "\r   Esperando... intento $attempt/$max_attempts"
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${YELLOW}⚠️  Redis no pudo iniciar, pero continuaremos (el sistema funcionará sin Redis)${NC}"
else
    echo -e "\n${GREEN}   ✅ Redis está listo!${NC}"
fi

# Paso 2: Verificar configuración antes de copiar
echo -e "\n${YELLOW}2. Verificando configuración...${NC}"
cd backend

# Verificar configuración en .env.local
echo -e "${YELLOW}Verificando .env.local...${NC}"

# Verificar API Key de Google
if grep -q "TU_API_KEY_AQUI" .env.local || grep -q "tu_api_key_real_aqui" .env.local; then
    echo -e "\n${RED}❌ FALTA: Google AI API Key${NC}"
    echo "   Edita backend/.env.local y configura GOOGLE_AI_API_KEY"
    echo "   Obtén una en: https://makersuite.google.com/app/apikey"
    missing_config=true
else
    echo -e "${GREEN}✅ Google AI API Key configurada${NC}"
fi

# Verificar credenciales de WhatsApp
if grep -q "tu_phone_number_id" .env.local || grep -q "tu_access_token_permanente" .env.local || grep -q "un_token_secreto_que_tu_elijas" .env.local; then
    echo -e "\n${RED}❌ FALTA: Credenciales de WhatsApp${NC}"
    echo "   Edita backend/.env.local y configura:"
    echo "   - WHATSAPP_PHONE_NUMBER_MESSAGING_ID"
    echo "   - WHATSAPP_ACCESS_TOKEN"
    echo "   - WHATSAPP_VERIFY_TOKEN"
    echo "   - BOT_WHATSAPP_NUMBER"
    echo "   Obtén las credenciales en: https://developers.facebook.com"
    missing_config=true
else
    echo -e "${GREEN}✅ Credenciales de WhatsApp configuradas${NC}"
fi

if [ "$missing_config" = true ]; then
    echo -e "\n${YELLOW}Ver QUICK_START.md para instrucciones detalladas${NC}"
    echo ""
    read -p "Presiona ENTER cuando hayas configurado todo..."
fi

# Copiar archivo de entorno
echo -e "\n${YELLOW}Copiando .env.local a .env...${NC}"
cp .env.local .env
echo -e "${GREEN}✅ Archivo .env creado${NC}"

# Paso 3: Instalar dependencias
echo -e "\n${YELLOW}3. Instalando dependencias...${NC}"
npm install

# Paso 4: Generar Prisma Client
echo -e "\n${YELLOW}4. Generando Prisma Client...${NC}"
npm run generate

# Paso 5: Ejecutar migraciones
echo -e "\n${YELLOW}5. Creando tablas en la base de datos...${NC}"
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init

# Paso 6: Ejecutar seed
echo -e "\n${YELLOW}6. Agregando datos iniciales (menú)...${NC}"
npm run seed

# Paso 6.5: Configurar pgvector si está disponible
echo -e "\n${YELLOW}6.5. Configurando búsqueda semántica (pgvector)...${NC}"
if [ -f "./scripts/setup-local-pgvector.sh" ]; then
    ./scripts/setup-local-pgvector.sh
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ pgvector configurado correctamente${NC}"
        # Generar embeddings si la configuración fue exitosa
        echo -e "${YELLOW}   Generando embeddings para productos...${NC}"
        npm run seed:embeddings 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Embeddings generados${NC}"
        else
            echo -e "${YELLOW}⚠️  No se pudieron generar embeddings (se generarán al iniciar)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  pgvector no pudo configurarse (búsqueda semántica no disponible)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Script de configuración no encontrado${NC}"
fi

# Paso 7: Verificar e instalar dependencias del frontend si existe
if [ -d "../frontend-app" ] && [ -f "../frontend-app/package.json" ]; then
    echo -e "\n${YELLOW}7. Verificando frontend...${NC}"
    cd ../frontend-app
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}   Instalando dependencias del frontend...${NC}"
        npm install
    fi
    cd ../backend
fi

# Función para limpiar al salir
cleanup() {
    echo -e "\n${YELLOW}⏹️  Deteniendo servicios...${NC}"
    pkill -P $$
    exit 0
}

# Capturar Ctrl+C
trap cleanup INT

# Paso 8: Iniciar servicios
echo -e "\n${GREEN}✅ Todo listo! Iniciando servicios...${NC}"

# Iniciar backend
echo -e "${YELLOW}🖥️  Iniciando Backend...${NC}"
npm run dev 2>&1 | sed 's/^/[Backend] /' &
BACKEND_PID=$!

# Esperar un poco para que el backend inicie
sleep 3

# Iniciar frontend si existe
if [ -d "../frontend-app" ] && [ -f "../frontend-app/package.json" ]; then
    echo -e "${YELLOW}🌐 Iniciando Frontend...${NC}"
    cd ../frontend-app && npm run dev 2>&1 | sed 's/^/[Frontend] /' &
    FRONTEND_PID=$!
    cd ../backend
fi

echo -e "\n${GREEN}✅ Servicios iniciados:${NC}"
echo -e "   Backend:  ${BLUE}http://localhost:5000${NC}"
if [ ! -z "$FRONTEND_PID" ]; then
    echo -e "   Frontend: ${BLUE}http://localhost:3000${NC}"
fi
echo -e "   Prisma Studio: ${YELLOW}npx prisma studio${NC}"
echo -e "   Logs de Docker: ${YELLOW}docker compose logs -f${NC}"
echo -e "\n${BLUE}📱 Para conectar WhatsApp:${NC}"
echo -e "   1. En otra terminal ejecuta: ${YELLOW}ngrok http 5000${NC}"
echo -e "   2. Copia la URL HTTPS que te da ngrok"
echo -e "   3. Configura el webhook en Meta Developers"
echo -e "   4. ¡Envía mensajes a tu número de WhatsApp!"
echo -e "\n${YELLOW}Para detener todo: Ctrl+C y luego: docker compose down${NC}"
echo ""

# Esperar a los procesos
wait $BACKEND_PID