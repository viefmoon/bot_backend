#!/bin/bash

# Script de verificación de salud del sistema
# Autor: Bot Backend Health Check
# Uso: ./health-check.sh

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "\n${MAGENTA}=== $1 ===${NC}"
}

check_service() {
    local service=$1
    local display_name=$2
    
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}✓${NC} $display_name: ${GREEN}Activo${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} $display_name: ${RED}Inactivo${NC}"
        return 1
    fi
}

check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} Puerto $port ($service): ${GREEN}Abierto${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} Puerto $port ($service): ${RED}Cerrado${NC}"
        return 1
    fi
}

check_process() {
    local process=$1
    local display_name=$2
    
    if pgrep -f "$process" > /dev/null; then
        local count=$(pgrep -f "$process" | wc -l)
        echo -e "${GREEN}✓${NC} $display_name: ${GREEN}$count proceso(s) activo(s)${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} $display_name: ${RED}No encontrado${NC}"
        return 1
    fi
}

# Header
clear
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BOT BACKEND - HEALTH CHECK         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "Fecha: $(date)"

# Sistema
print_header "INFORMACIÓN DEL SISTEMA"
echo "Hostname: $(hostname)"
echo "IP: $(hostname -I | awk '{print $1}')"
echo "Uptime: $(uptime -p)"
echo ""

# Recursos
print_header "RECURSOS DEL SISTEMA"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')"
echo "RAM: $(free -h | awk '/^Mem:/ {print $3 " / " $2}')"
echo "Disco: $(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 " usado)"}')"
echo ""

# Servicios del sistema
print_header "SERVICIOS DEL SISTEMA"
check_service "postgresql" "PostgreSQL"
check_service "redis-server" "Redis"
check_service "nginx" "Nginx"
echo ""

# Puertos
print_header "PUERTOS"
check_port 5000 "Backend API"
check_port 5432 "PostgreSQL" 2>/dev/null || check_port 5433 "PostgreSQL"
check_port 6379 "Redis" 2>/dev/null || check_port 6380 "Redis"
check_port 80 "HTTP"
check_port 443 "HTTPS"
echo ""

# Procesos de la aplicación
print_header "PROCESOS DE APLICACIÓN"
check_process "PM2" "PM2 Manager"
check_process "bot-backend-api" "API Backend"
check_process "bot-backend-worker" "Worker Process"
echo ""

# PM2 Status
if command -v pm2 &> /dev/null; then
    print_header "ESTADO PM2"
    pm2 list --no-color | grep -E "bot-backend|App name|─────"
    echo ""
fi

# Verificar conectividad
print_header "CONECTIVIDAD"

# API Health
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health | grep -q "200"; then
    echo -e "${GREEN}✓${NC} API Health: ${GREEN}OK${NC}"
else
    echo -e "${RED}✗${NC} API Health: ${RED}Error${NC}"
fi

# Base de datos
if PGPASSWORD=$(grep DATABASE_URL ~/bot_backend/backend/.env 2>/dev/null | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/') psql -U bot_user -h localhost -d bot_db -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Conexión PostgreSQL: ${GREEN}OK${NC}"
else
    echo -e "${YELLOW}!${NC} Conexión PostgreSQL: ${YELLOW}No verificable${NC}"
fi

# Redis
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Conexión Redis: ${GREEN}OK${NC}"
else
    echo -e "${RED}✗${NC} Conexión Redis: ${RED}Error${NC}"
fi
echo ""

# Logs recientes
print_header "ÚLTIMOS ERRORES (si hay)"
if [ -f /var/log/nginx/bot-backend-error.log ]; then
    tail -5 /var/log/nginx/bot-backend-error.log 2>/dev/null | grep -v "^$" || echo "Sin errores recientes en Nginx"
fi
echo ""

# Resumen
print_header "RESUMEN"
echo -e "${BLUE}Use los siguientes comandos para más información:${NC}"
echo "• pm2 logs          - Ver logs de la aplicación"
echo "• pm2 monit         - Monitor en tiempo real"
echo "• systemctl status  - Estado de servicios"
echo "• htop              - Monitor de recursos"
echo ""