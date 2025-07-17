#!/bin/bash

echo "🚀 Iniciando backend con workers localmente..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para matar proceso en un puerto
kill_port() {
    local port=$1
    # Intentar múltiples métodos para encontrar el PID
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    # Si lsof no funciona, intentar con fuser
    if [ -z "$pid" ]; then
        pid=$(fuser $port/tcp 2>/dev/null | tr -d ' ')
    fi
    
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Puerto $port en uso por proceso(es) $pid. Liberando puerto...${NC}"
        # Intentar kill normal primero
        kill $pid 2>/dev/null || true
        sleep 1
        
        # Si aún existe, forzar
        if kill -0 $pid 2>/dev/null; then
            kill -9 $pid 2>/dev/null || true
            sleep 1
        fi
    fi
    
    # Verificar si el puerto sigue ocupado
    if lsof -i:$port >/dev/null 2>&1 || fuser $port/tcp >/dev/null 2>&1; then
        echo -e "${RED}❌ No se pudo liberar el puerto $port. Puede requerir permisos de sudo.${NC}"
        echo -e "${YELLOW}   Intenta ejecutar: sudo kill -9 \$(sudo lsof -ti:$port)${NC}"
    fi
}

# Función para limpiar contenedores Docker específicos
cleanup_docker_containers() {
    echo -e "${YELLOW}Limpiando contenedores Docker...${NC}"
    
    # Lista de contenedores específicos del proyecto
    local containers=("redis_bot_backend" "postgres_bot_backend")
    
    for container in "${containers[@]}"; do
        if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
            echo -e "${YELLOW}   Deteniendo y eliminando contenedor: $container${NC}"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
    
    # También detener usando docker compose
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Esperar un poco para asegurar que los procesos docker-proxy se liberen
    sleep 3
    
    # Buscar y matar procesos docker-proxy huérfanos que estén usando nuestros puertos
    for port in 5433 6380; do
        local docker_proxy_pids=$(ps aux | grep docker-proxy | grep "\-host-port $port" | awk '{print $2}' | tr '\n' ' ')
        if [ ! -z "$docker_proxy_pids" ]; then
            echo -e "${YELLOW}   Encontrados procesos docker-proxy huérfanos en puerto $port: $docker_proxy_pids${NC}"
            echo -e "${YELLOW}   Estos procesos requieren permisos de root para eliminarlos.${NC}"
            
            # Intentar matarlos normalmente primero
            for pid in $docker_proxy_pids; do
                if kill -9 $pid 2>/dev/null; then
                    echo -e "${GREEN}   ✓ Proceso $pid eliminado${NC}"
                else
                    echo -e "${RED}   ✗ No se pudo eliminar proceso $pid (requiere sudo)${NC}"
                    echo -e "${YELLOW}   Por favor ejecuta: sudo kill -9 $pid${NC}"
                fi
            done
        fi
    done
    
    # Verificar si los contenedores zombis aún existen
    local zombie_containers=$(docker ps -a | grep -E "(redis_bot_backend|postgres_bot_backend)" | grep -E "(Dead|Removal In Progress)" | awk '{print $1}')
    if [ ! -z "$zombie_containers" ]; then
        echo -e "${YELLOW}   Encontrados contenedores zombis: $zombie_containers${NC}"
        for container_id in $zombie_containers; do
            docker rm -f "$container_id" 2>/dev/null || true
        done
    fi
}

# Limpiar puertos antes de iniciar
echo -e "\n${YELLOW}0. Limpiando puertos y contenedores...${NC}"

# Verificar si hay procesos docker-proxy huérfanos antes de empezar
DOCKER_PROXY_FOUND=false
for port in 5433 6380; do
    if ps aux | grep docker-proxy | grep -q "\-host-port $port"; then
        DOCKER_PROXY_FOUND=true
        echo -e "${RED}❌ Detectados procesos docker-proxy huérfanos en puerto $port${NC}"
        pids=$(ps aux | grep docker-proxy | grep "\-host-port $port" | awk '{print $2}')
        echo -e "${YELLOW}   PIDs: $pids${NC}"
    fi
done

if [ "$DOCKER_PROXY_FOUND" = true ]; then
    echo -e "\n${YELLOW}⚠️  Se encontraron procesos docker-proxy que requieren permisos de root para eliminar.${NC}"
    echo -e "${YELLOW}Por favor, ejecuta los siguientes comandos para limpiarlos:${NC}\n"
    
    # Generar comandos sudo para cada proceso
    for port in 5433 6380; do
        pids=$(ps aux | grep docker-proxy | grep "\-host-port $port" | awk '{print $2}' | tr '\n' ' ')
        if [ ! -z "$pids" ]; then
            echo -e "${BLUE}sudo kill -9 $pids${NC}"
        fi
    done
    
    echo -e "\n${YELLOW}Alternativamente, puedes ejecutar:${NC}"
    echo -e "${BLUE}./cleanup-ports.sh${NC}"
    echo -e "${YELLOW}para limpiar automáticamente todos los puertos y contenedores.${NC}"
    
    echo -e "\n${YELLOW}Después de ejecutar uno de los comandos anteriores, vuelve a ejecutar este script.${NC}"
    exit 1
fi

# Primero limpiar contenedores Docker
cleanup_docker_containers

# Luego limpiar puertos
kill_port 3000  # Frontend
kill_port 5000  # Backend
kill_port 5433  # PostgreSQL
kill_port 6380  # Redis

# Verificación final de puertos
for port in 5433 6380; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ El puerto $port sigue en uso después de la limpieza.${NC}"
        echo -e "${YELLOW}   Intentando limpieza forzada...${NC}"
        # Intentar con fuser como último recurso
        fuser -k $port/tcp 2>/dev/null || true
        sleep 1
    fi
done

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

# Verificar si existe .env.local (para compatibilidad con instalaciones anteriores)
if [ -f ".env.local" ]; then
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
elif [ ! -f ".env" ]; then
    # Si no existe .env ni .env.local, crear uno desde .env.example
    echo -e "${YELLOW}No se encontró .env, creándolo desde .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❌ IMPORTANTE: Debes configurar el archivo backend/.env con tus credenciales${NC}"
    echo -e "${YELLOW}Ver QUICK_START.md para instrucciones detalladas${NC}"
    exit 1
fi

# Paso 3: Instalar dependencias
echo -e "\n${YELLOW}3. Instalando dependencias...${NC}"
npm install

# Paso 4: Generar Prisma Client
echo -e "\n${YELLOW}4. Generando Prisma Client...${NC}"
npm run generate

# Paso 5: Ejecutar migraciones
echo -e "\n${YELLOW}5. Creando tablas en la base de datos...${NC}"
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init

# Paso 6.5: Configurar pgvector si está disponible
echo -e "\n${YELLOW}6.5. Configurando búsqueda semántica (pgvector)...${NC}"
if [ -f "./scripts/setup-local-pgvector.sh" ]; then
    ./scripts/setup-local-pgvector.sh
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ pgvector configurado correctamente${NC}"
        echo -e "${YELLOW}   Los embeddings se generarán automáticamente al iniciar el servidor${NC}"
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

# Variables de proceso
BACKEND_PID=""
WORKER_PID=""
FRONTEND_PID=""

# Función para limpiar al salir
cleanup() {
    echo -e "\n${YELLOW}⏹️  Deteniendo servicios...${NC}"
    
    # Matar procesos hijos (backend, worker y frontend)
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}   Deteniendo proceso backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$WORKER_PID" ]; then
        echo -e "${YELLOW}   Deteniendo proceso worker (PID: $WORKER_PID)...${NC}"
        kill $WORKER_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}   Deteniendo proceso frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Matar cualquier otro proceso hijo
    pkill -P $$ 2>/dev/null || true
    
    # Dar tiempo para que los procesos terminen
    sleep 2
    
    # Limpiar contenedores Docker
    echo -e "${YELLOW}   Limpiando contenedores Docker...${NC}"
    cleanup_docker_containers
    
    # Limpiar puertos por si acaso
    echo -e "${YELLOW}   Liberando puertos...${NC}"
    kill_port 3000
    kill_port 5000
    kill_port 5433
    kill_port 6380
    
    echo -e "${GREEN}✅ Todos los servicios y puertos han sido liberados${NC}"
    exit 0
}

# Capturar señales de terminación
trap cleanup INT TERM EXIT

# Paso 8: Iniciar servicios
echo -e "\n${GREEN}✅ Todo listo! Iniciando servicios...${NC}"

# Iniciar backend API
echo -e "${YELLOW}🖥️  Iniciando Backend API...${NC}"
npm run dev 2>&1 | sed 's/^/[API] /' &
BACKEND_PID=$!

# Esperar un poco para que el backend API inicie
sleep 3

# Iniciar worker de BullMQ
echo -e "${YELLOW}⚙️  Iniciando Worker de BullMQ...${NC}"
npm run dev:worker 2>&1 | sed 's/^/[Worker] /' &
WORKER_PID=$!

# Iniciar frontend si existe
if [ -d "../frontend-app" ] && [ -f "../frontend-app/package.json" ]; then
    echo -e "${YELLOW}🌐 Iniciando Frontend...${NC}"
    cd ../frontend-app && npm run dev 2>&1 | sed 's/^/[Frontend] /' &
    FRONTEND_PID=$!
    cd ../backend
fi

# Leer configuración de workers
WORKER_CONCURRENCY=$(grep BULLMQ_WORKER_CONCURRENCY .env | cut -d '=' -f2 || echo "2")
NUM_WORKERS=$(grep NUM_WORKERS .env | cut -d '=' -f2 || echo "1")

echo -e "\n${GREEN}✅ Servicios iniciados:${NC}"
echo -e "   Backend API:  ${BLUE}http://localhost:5000${NC}"
echo -e "   Worker:       ${GREEN}Procesando mensajes (Concurrencia: $WORKER_CONCURRENCY)${NC}"
if [ ! -z "$FRONTEND_PID" ]; then
    echo -e "   Frontend:     ${BLUE}http://localhost:3000${NC}"
fi
echo -e "\n${YELLOW}📊 Herramientas adicionales:${NC}"
echo -e "   Prisma Studio: ${YELLOW}cd backend && npx prisma studio${NC}"
echo -e "   Logs de Docker: ${YELLOW}docker compose logs -f${NC}"
echo -e "\n${BLUE}📱 Para conectar WhatsApp:${NC}"
echo -e "   1. En otra terminal ejecuta: ${YELLOW}ngrok http 5000${NC}"
echo -e "   2. Copia la URL HTTPS que te da ngrok"
echo -e "   3. Configura el webhook en Meta Developers"
echo -e "   4. ¡Envía mensajes a tu número de WhatsApp!"
echo -e "\n${GREEN}🚀 Configuración de Workers:${NC}"
echo -e "   Concurrencia por worker: ${YELLOW}$WORKER_CONCURRENCY trabajos simultáneos${NC}"
echo -e "   Número de workers (dev): ${YELLOW}1 (para producción usa PM2)${NC}"
echo -e "   Para cambiar: edita ${YELLOW}BULLMQ_WORKER_CONCURRENCY${NC} en backend/.env"
echo -e "\n${YELLOW}Para detener todo: Ctrl+C (el script limpiará todo automáticamente)${NC}"
echo ""

# Esperar a los procesos
wait $BACKEND_PID