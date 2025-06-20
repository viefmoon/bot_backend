#!/bin/bash

# Script para limpiar puertos ocupados por docker-proxy

echo "🧹 Limpiando puertos ocupados por Docker..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Función para limpiar un puerto específico
cleanup_port() {
    local port=$1
    echo -e "${YELLOW}Verificando puerto $port...${NC}"
    
    # Buscar procesos docker-proxy en este puerto
    local pids=$(ps aux | grep docker-proxy | grep "\-host-port $port" | awk '{print $2}' | tr '\n' ' ')
    
    if [ ! -z "$pids" ]; then
        echo -e "${RED}Encontrados procesos docker-proxy en puerto $port: $pids${NC}"
        
        # Intentar matar los procesos
        if [[ $EUID -eq 0 ]]; then
            # Si somos root, matarlos directamente
            for pid in $pids; do
                if kill -9 $pid 2>/dev/null; then
                    echo -e "${GREEN}✅ Proceso $pid eliminado${NC}"
                else
                    echo -e "${RED}❌ No se pudo eliminar proceso $pid${NC}"
                fi
            done
        else
            # Si no somos root, usar sudo
            echo -e "${YELLOW}Ejecutando con sudo...${NC}"
            sudo kill -9 $pids
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Procesos eliminados${NC}"
            else
                echo -e "${RED}❌ Error al eliminar procesos${NC}"
            fi
        fi
    else
        echo -e "${GREEN}✅ Puerto $port está libre${NC}"
    fi
}

# Detener todos los contenedores Docker primero
echo -e "\n${YELLOW}Deteniendo contenedores Docker...${NC}"
docker stop $(docker ps -q) 2>/dev/null || true
docker compose down --remove-orphans 2>/dev/null || true

# Esperar un poco
sleep 2

# Limpiar puertos específicos
echo -e "\n${YELLOW}Limpiando puertos...${NC}"
cleanup_port 5433
cleanup_port 6380
cleanup_port 3000
cleanup_port 5000

# Limpiar contenedores detenidos
echo -e "\n${YELLOW}Eliminando contenedores detenidos...${NC}"
docker container prune -f 2>/dev/null || true

echo -e "\n${GREEN}✅ Limpieza completada!${NC}"
echo -e "${YELLOW}Ahora puedes ejecutar ./start-local.sh${NC}"