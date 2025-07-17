#!/bin/bash

# Script para configurar la aplicación Bot Backend
# Autor: Bot Backend Deployment Script
# Uso: ./setup-app.sh (NO requiere sudo)

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Verificar que NO se ejecuta como root
if [[ $EUID -eq 0 ]]; then
   print_error "Este script NO debe ejecutarse como root"
   exit 1
fi

# Verificar que estamos en el directorio correcto
if [ ! -f "backend/package.json" ]; then
    print_error "Este script debe ejecutarse desde el directorio raíz del proyecto (bot_backend)"
    exit 1
fi

print_step "Configurando aplicación Bot Backend..."

# Instalar dependencias del backend
print_step "Instalando dependencias del backend..."
cd backend
npm install --production
print_success "Dependencias del backend instaladas"

# Instalar y construir frontend
print_step "Instalando y construyendo frontend..."
cd ../frontend-app
npm install
npm run build
print_success "Frontend construido para producción"

# Volver al backend
cd ../backend

# Copiar archivo de entorno
if [ ! -f ".env" ]; then
    print_step "Creando archivo .env..."
    cp .env.example .env
    print_warning "Archivo .env creado. DEBES editarlo con tus credenciales reales"
else
    print_success "Archivo .env ya existe"
fi

# Generar cliente Prisma
print_step "Generando cliente Prisma..."
npm run generate
print_success "Cliente Prisma generado"

# Solicitar confirmación para migraciones
echo ""
print_warning "¿Has configurado las variables de entorno en .env?"
read -p "¿Deseas ejecutar las migraciones de base de datos ahora? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_step "Ejecutando migraciones de base de datos..."
    npm run migrate
    print_success "Migraciones aplicadas"
    
    # Preguntar por embeddings
    read -p "¿Deseas generar embeddings para búsqueda semántica? (s/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        print_step "Generando embeddings..."
        npm run seed:embeddings
        print_success "Embeddings generados"
    fi
else
    print_warning "Migraciones omitidas. Ejecuta 'npm run migrate' cuando hayas configurado .env"
fi

# Compilar el proyecto
print_step "Compilando proyecto TypeScript..."
npm run build
print_success "Proyecto compilado"

# Configurar PM2
print_step "Configurando PM2..."
pm2 startup systemd -u $USER --hp $HOME
print_success "PM2 configurado para inicio automático"

# Crear directorios necesarios
print_step "Creando directorios necesarios..."
mkdir -p logs
mkdir -p uploads
print_success "Directorios creados"

# Verificar configuración
print_step "Verificando configuración..."
echo ""

# Verificar archivo .env
if [ -f ".env" ]; then
    # Contar variables configuradas
    CONFIGURED_VARS=$(grep -E "^[A-Z_]+=" .env | grep -v "=$" | wc -l)
    TOTAL_VARS=$(grep -E "^[A-Z_]+=" .env | wc -l)
    
    if [ $CONFIGURED_VARS -eq $TOTAL_VARS ]; then
        print_success "Todas las variables de entorno parecen estar configuradas ($CONFIGURED_VARS/$TOTAL_VARS)"
    else
        print_warning "Solo $CONFIGURED_VARS de $TOTAL_VARS variables están configuradas"
        print_warning "Revisa y completa el archivo .env"
    fi
else
    print_error "Archivo .env no encontrado"
fi

# Mostrar resumen
echo ""
echo "================================="
echo "RESUMEN DE CONFIGURACIÓN"
echo "================================="
echo ""
print_success "Instalación completada"
echo ""
echo "Para iniciar la aplicación:"
echo ""
echo "1. Edita el archivo backend/.env con tus credenciales:"
echo "   cd backend && nano .env"
echo ""
echo "2. Si no ejecutaste las migraciones, hazlo ahora:"
echo "   cd backend && npm run migrate"
echo ""
echo "3. Inicia la aplicación con PM2:"
echo "   cd backend && npm run pm2:start"
echo ""
echo "4. Verifica los logs:"
echo "   pm2 logs"
echo ""
echo "5. Monitorea los procesos:"
echo "   pm2 monit"
echo ""
print_warning "IMPORTANTE: Configura Nginx para servir el frontend y hacer proxy al API"
print_success "Frontend construido en: ~/bot_backend/frontend-app/dist"

# Guardar información útil
cat > ~/bot_backend_info.txt <<EOF
================================
BOT BACKEND - INFORMACIÓN ÚTIL
================================

COMANDOS PM2:
- Ver estado: pm2 status
- Ver logs: pm2 logs
- Reiniciar: pm2 restart all
- Detener: pm2 stop all
- Monitorear: pm2 monit

RUTAS DE LA APLICACIÓN:
- Backend: ~/bot_backend/backend
- Frontend: ~/bot_backend/frontend-app/dist
- Logs: ~/bot_backend/backend/logs
- Uploads: ~/bot_backend/backend/uploads

PUERTOS:
- API Backend: 5000
- PostgreSQL: 5432
- Redis: 6379

COMANDOS ÚTILES:
- Actualizar app: cd ~/bot_backend && git pull && cd backend && npm install && npm run build && pm2 reload all
- Ver logs en tiempo real: pm2 logs --lines 100
- Backup de BD: pg_dump -U bot_user bot_db > backup.sql

================================
EOF

print_success "Información guardada en ~/bot_backend_info.txt"