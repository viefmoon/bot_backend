#!/bin/bash

# Script para actualizar la aplicación con opción de reset completo de base de datos
# Autor: Bot Backend Update Script with Reset Option
# Uso: ./update-app-with-reset.sh [--reset-db]

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
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

print_info() {
    echo -e "${MAGENTA}ℹ${NC} $1"
}

# Banner
echo ""
echo "================================================"
echo -e "${BLUE}Bot Backend - Script de Actualización Completa${NC}"
echo "================================================"
echo ""

# Verificar parámetros
RESET_DB=false
if [[ "$1" == "--reset-db" ]]; then
    RESET_DB=true
fi

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

# Mostrar estado actual
print_step "Verificando estado actual..."
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_info "Rama actual: $CURRENT_BRANCH"
print_info "Commit actual: ${CURRENT_COMMIT:0:7}"

# Guardar cambios locales si existen
print_step "Verificando cambios locales..."
if [[ -n $(git status --porcelain) ]]; then
    print_warning "Hay cambios locales no guardados"
    read -p "¿Deseas guardarlos temporalmente? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        STASH_NAME="update-$(date +%Y%m%d_%H%M%S)"
        git stash save "$STASH_NAME"
        print_success "Cambios guardados como: $STASH_NAME"
    fi
fi

# Obtener última versión
print_step "Obteniendo última versión del repositorio..."
git fetch origin
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH)

# Verificar si hay actualizaciones
if [ "$CURRENT_COMMIT" == "$REMOTE_COMMIT" ]; then
    print_warning "Ya estás en la última versión"
    if [ "$RESET_DB" != true ]; then
        print_info "Usa --reset-db si deseas resetear la base de datos de todas formas"
        exit 0
    fi
    print_info "Continuando con el reset de base de datos..."
else
    # Mostrar cambios pendientes
    print_step "Cambios pendientes:"
    git log HEAD..origin/$CURRENT_BRANCH --oneline
fi

# Menú de opciones
echo ""
echo "================================================"
echo -e "${YELLOW}Opciones de Actualización${NC}"
echo "================================================"
echo ""

if [ "$RESET_DB" == true ]; then
    echo -e "${RED}⚠️  MODO RESET: Se eliminará TODA la base de datos ⚠️${NC}"
    echo ""
    echo "Este modo realizará:"
    echo "1. Actualización completa del código"
    echo "2. ELIMINACIÓN completa de la base de datos"
    echo "3. Recreación desde cero con nuevas migraciones"
    echo "4. Reinicio completo de servicios"
    echo ""
    echo -e "${RED}TODOS LOS DATOS SERÁN ELIMINADOS${NC}"
    echo ""
    read -p "¿Estás ABSOLUTAMENTE SEGURO? Escribe 'SI RESET': " -r
    echo
    if [[ ! $REPLY == "SI RESET" ]]; then
        print_error "Operación cancelada"
        exit 1
    fi
else
    echo "Actualización estándar:"
    echo "1. Actualización del código"
    echo "2. Instalación de dependencias"
    echo "3. Aplicación de migraciones (si existen)"
    echo "4. Compilación y reinicio de servicios"
    echo ""
    echo -e "${YELLOW}Nota:${NC} Usa --reset-db para reset completo de BD"
    echo ""
    read -p "¿Continuar con la actualización? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_warning "Actualización cancelada"
        exit 0
    fi
fi

# Actualizar código
print_step "Actualizando código..."
git pull origin $CURRENT_BRANCH
NEW_COMMIT=$(git rev-parse HEAD)
print_success "Código actualizado a ${NEW_COMMIT:0:7}"

# Si es modo reset, ejecutar script de reset
if [ "$RESET_DB" == true ]; then
    print_step "Ejecutando reset completo de base de datos..."
    
    # Verificar que existe el script de reset
    if [ ! -f "./scripts/reset-database-production.sh" ]; then
        print_error "No se encontró el script de reset de base de datos"
        exit 1
    fi
    
    # Hacer ejecutable y ejecutar
    chmod +x ./scripts/reset-database-production.sh
    ./scripts/reset-database-production.sh
    
    print_success "Reset de base de datos completado"
    
else
    # Actualización estándar
    cd backend
    
    # Instalar dependencias
    print_step "Instalando dependencias..."
    npm install --production
    print_success "Dependencias instaladas"
    
    # Generar cliente Prisma
    print_step "Generando cliente Prisma..."
    npm run generate
    print_success "Cliente Prisma generado"
    
    # Verificar migraciones pendientes
    print_step "Verificando migraciones pendientes..."
    if npm run migrate:pending 2>/dev/null | grep -q "pending"; then
        print_warning "Hay migraciones pendientes"
        echo ""
        echo "Las siguientes migraciones serán aplicadas:"
        npx prisma migrate status | grep "Database schema is not up to date" -A 10 || true
        echo ""
        read -p "¿Aplicar migraciones ahora? (s/n): " -n 1 -r
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
    
    # Actualizar frontend si existe
    if [ -d "../frontend-app" ]; then
        print_step "Actualizando frontend..."
        cd ../frontend-app
        npm install
        npm run build || print_warning "Build del frontend tuvo advertencias"
        
        # Asegurar permisos correctos
        chmod -R 755 dist/
        chmod 755 ~/bot_backend
        chmod 755 ~/bot_backend/frontend-app
        print_success "Frontend actualizado"
        
        cd ../backend
    fi
    
    # Reload PM2 con zero-downtime
    print_step "Recargando aplicación con PM2..."
    pm2 reload ecosystem.config.js
    print_success "Aplicación recargada"
fi

# Verificar estado final
print_step "Verificando estado de la aplicación..."
sleep 3
pm2 status

# Health check
print_step "Verificando salud de la aplicación..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/backend | grep -q "200"; then
    print_success "API respondiendo correctamente"
else
    print_error "API no responde - verifica los logs con: pm2 logs"
fi

# Resumen final
echo ""
echo "================================================"
if [ "$RESET_DB" == true ]; then
    echo -e "${GREEN}¡Actualización con Reset Completada!${NC}"
else
    echo -e "${GREEN}¡Actualización Completada!${NC}"
fi
echo "================================================"
echo ""
echo "Versión actual:"
git log -1 --pretty=format:"%h - %s (%cr) <%an>" --abbrev-commit
echo ""
echo ""

if [ "$RESET_DB" == true ]; then
    echo -e "${YELLOW}Importante:${NC}"
    echo "• La base de datos fue completamente reseteada"
    echo "• Todos los datos anteriores fueron eliminados"
    echo "• Necesitarás crear nuevos datos de prueba"
    echo ""
fi

echo "Comandos útiles:"
echo "• pm2 logs       - Ver logs en tiempo real"
echo "• pm2 monit      - Monitor de procesos"
echo "• pm2 status     - Estado de procesos"
echo "• pm2 logs --err - Ver solo errores"
echo ""

# Si hay stash guardado, recordar al usuario
if git stash list | grep -q "$STASH_NAME"; then
    print_warning "Recuerda: tienes cambios locales guardados como '$STASH_NAME'"
    echo "Usa 'git stash list' para ver todos los stashes"
    echo "Usa 'git stash pop' para recuperar los cambios"
fi