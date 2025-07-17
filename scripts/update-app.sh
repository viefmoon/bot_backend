#!/bin/bash

# Script para actualizar la aplicación en producción
# Autor: Bot Backend Update Script
# Uso: ./update-app.sh

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Verificar que NO se ejecuta como root
if [[ $EUID -eq 0 ]]; then
   print_error "Este script NO debe ejecutarse como root"
   exit 1
fi

# Verificar que estamos en el directorio correcto
if [ ! -d "$HOME/bot_backend" ]; then
    print_error "No se encontró el directorio ~/bot_backend"
    exit 1
fi

cd ~/bot_backend

print_step "Iniciando actualización de Bot Backend..."

# Guardar cambios locales si existen
print_step "Verificando cambios locales..."
if [[ -n $(git status --porcelain) ]]; then
    print_warning "Hay cambios locales no guardados"
    read -p "¿Deseas guardarlos temporalmente? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        git stash save "Actualización automática $(date +%Y%m%d_%H%M%S)"
        print_success "Cambios guardados temporalmente"
    fi
fi

# Obtener última versión
print_step "Obteniendo última versión del repositorio..."
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_success "Rama actual: $CURRENT_BRANCH"

# Mostrar cambios pendientes
print_step "Cambios pendientes:"
git log HEAD..origin/$CURRENT_BRANCH --oneline

# Confirmar actualización
echo ""
read -p "¿Deseas continuar con la actualización? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_warning "Actualización cancelada"
    exit 0
fi

# Actualizar código
print_step "Actualizando código..."
git pull origin $CURRENT_BRANCH
print_success "Código actualizado"

# Cambiar al directorio backend
cd backend

# Instalar dependencias
print_step "Instalando dependencias..."
npm install --production
print_success "Dependencias instaladas"

# Generar cliente Prisma
print_step "Generando cliente Prisma..."
npm run generate
print_success "Cliente Prisma generado"

# Verificar si hay migraciones pendientes
print_step "Verificando migraciones pendientes..."
if npm run migrate:pending 2>/dev/null | grep -q "pending"; then
    print_warning "Hay migraciones pendientes"
    read -p "¿Deseas aplicar las migraciones ahora? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        npm run migrate
        print_success "Migraciones aplicadas"
    else
        print_warning "Migraciones omitidas - aplícalas manualmente con: npm run migrate"
    fi
else
    print_success "No hay migraciones pendientes"
fi

# Compilar proyecto
print_step "Compilando proyecto..."
npm run build
print_success "Proyecto compilado"

# Reload PM2 con zero-downtime
print_step "Recargando aplicación con PM2..."
pm2 reload ecosystem.config.js
print_success "Aplicación recargada"

# Verificar estado
print_step "Verificando estado de la aplicación..."
sleep 3
pm2 status

# Verificar logs por errores
print_step "Verificando logs..."
echo "Últimas líneas de logs:"
pm2 logs --nostream --lines 10

# Health check
print_step "Verificando salud de la aplicación..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health | grep -q "200"; then
    print_success "API respondiendo correctamente"
else
    print_error "API no responde - verifica los logs con: pm2 logs"
fi

# Resumen
echo ""
echo "======================================"
echo -e "${GREEN}¡Actualización completada!${NC}"
echo "======================================"
echo ""
echo "Versión actual:"
git log -1 --pretty=format:"%h - %s (%cr) <%an>" --abbrev-commit
echo ""
echo ""
echo "Comandos útiles:"
echo "• pm2 logs     - Ver logs en tiempo real"
echo "• pm2 monit    - Monitor de procesos"
echo "• pm2 status   - Estado de procesos"
echo ""

# Si hay stash guardado, recordar al usuario
if git stash list | grep -q "Actualización automática"; then
    print_warning "Recuerda: tienes cambios locales guardados. Usa 'git stash pop' para recuperarlos."
fi