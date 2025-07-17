#!/bin/bash

# Script de instalación rápida de dependencias para Ubuntu
# Autor: Bot Backend Deployment Script
# Uso: sudo ./install-dependencies.sh

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Verificar que se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   print_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

print_step "Iniciando instalación de dependencias..."

# Actualizar sistema
print_step "Actualizando sistema..."
apt update && apt upgrade -y
print_success "Sistema actualizado"

# Instalar herramientas básicas
print_step "Instalando herramientas básicas..."
apt install -y curl wget git build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release
print_success "Herramientas básicas instaladas"

# Instalar Node.js 20.x
print_step "Instalando Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
print_success "Node.js $(node --version) instalado"
print_success "npm $(npm --version) instalado"

# Instalar PostgreSQL 15
print_step "Configurando repositorio de PostgreSQL..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update

print_step "Instalando PostgreSQL 15..."
apt install -y postgresql-15 postgresql-contrib-15 postgresql-15-pgvector
print_success "PostgreSQL 15 con pgvector instalado"

# Instalar Redis
print_step "Instalando Redis..."
apt install -y redis-server

# Configurar Redis para producción
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
sed -i 's/# maxmemory <bytes>/maxmemory 512mb/g' /etc/redis/redis.conf
sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/g' /etc/redis/redis.conf

systemctl restart redis-server
systemctl enable redis-server
print_success "Redis instalado y configurado"

# Instalar PM2
print_step "Instalando PM2 globalmente..."
npm install -g pm2
print_success "PM2 instalado"

# Instalar Nginx
print_step "Instalando Nginx..."
apt install -y nginx
print_success "Nginx instalado"

# Instalar Certbot para SSL
print_step "Instalando Certbot para SSL..."
apt install -y certbot python3-certbot-nginx
print_success "Certbot instalado"

# Instalar herramientas de monitoreo
print_step "Instalando herramientas de monitoreo..."
apt install -y htop iotop nethogs
print_success "Herramientas de monitoreo instaladas"

# Instalar fail2ban para seguridad
print_step "Instalando fail2ban..."
apt install -y fail2ban
systemctl enable fail2ban
print_success "fail2ban instalado"

# Instalar unattended-upgrades
print_step "Instalando actualizaciones automáticas de seguridad..."
apt install -y unattended-upgrades
print_success "Actualizaciones automáticas configuradas"

# Verificar servicios
print_step "Verificando servicios..."
echo ""
echo "Estado de servicios:"
echo "-------------------"

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL: Activo"
else
    print_error "PostgreSQL: Inactivo"
fi

# Redis
if systemctl is-active --quiet redis-server; then
    print_success "Redis: Activo"
else
    print_error "Redis: Inactivo"
fi

# Nginx
if systemctl is-active --quiet nginx; then
    print_success "Nginx: Activo"
else
    print_error "Nginx: Inactivo"
fi

echo ""
print_success "¡Instalación de dependencias completada!"
echo ""
print_warning "Próximos pasos:"
echo "1. Crear usuario no-root para la aplicación"
echo "2. Configurar PostgreSQL con usuario y base de datos"
echo "3. Clonar el repositorio y configurar variables de entorno"
echo "4. Ejecutar el script setup-app.sh"
echo ""
print_step "Versiones instaladas:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "PostgreSQL: $(psql --version | awk '{print $3}')"
echo "Redis: $(redis-server --version | awk '{print $3}' | cut -d'=' -f2)"
echo "Nginx: $(nginx -v 2>&1 | awk '{print $3}' | cut -d'/' -f2)"