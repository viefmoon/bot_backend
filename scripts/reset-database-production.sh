#!/bin/bash

# Script para resetear completamente la base de datos en producción
# ADVERTENCIA: Este script ELIMINARÁ TODOS LOS DATOS
# Autor: Bot Backend Reset Script
# Uso: ./reset-database-production.sh

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

# Banner de advertencia
echo ""
echo "================================================"
echo -e "${RED}⚠️  ADVERTENCIA - RESET COMPLETO DE BASE DE DATOS ⚠️${NC}"
echo "================================================"
echo ""
echo "Este script realizará las siguientes acciones:"
echo "1. Detener todos los procesos PM2"
echo "2. Hacer backup de la base de datos actual"
echo "3. ELIMINAR completamente la base de datos"
echo "4. Recrear la base de datos vacía"
echo "5. Ejecutar las nuevas migraciones"
echo "6. Reiniciar los servicios"
echo ""
echo -e "${RED}TODOS LOS DATOS SERÁN ELIMINADOS${NC}"
echo ""
read -p "¿Estás ABSOLUTAMENTE SEGURO que quieres continuar? Escribe 'SI ESTOY SEGURO': " -r
echo

if [[ ! $REPLY == "SI ESTOY SEGURO" ]]; then
    print_error "Reset cancelado"
    exit 1
fi

# Segunda confirmación
echo ""
echo -e "${YELLOW}Segunda confirmación por seguridad${NC}"
read -p "¿Realmente quieres ELIMINAR TODOS LOS DATOS? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_error "Reset cancelado"
    exit 1
fi

# Verificar que estamos en el servidor correcto
if [ ! -d "$HOME/bot_backend" ]; then
    print_error "No se encontró el directorio ~/bot_backend"
    print_error "¿Estás seguro que estás en el servidor correcto?"
    exit 1
fi

cd ~/bot_backend

# Paso 1: Detener PM2
print_step "Deteniendo todos los procesos PM2..."
pm2 stop all || true
print_success "Procesos detenidos"

# Paso 2: Backup de la base de datos actual
print_step "Creando backup de la base de datos actual..."
BACKUP_FILE="backup_before_reset_$(date +%Y%m%d_%H%M%S).sql"
cd ~/bot_backend/backend

# Obtener credenciales de la base de datos del .env
if [ -f .env ]; then
    export $(cat .env | grep -E '^DATABASE_URL=' | xargs)
    # Extraer componentes de DATABASE_URL
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*postgresql:\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
else
    # Valores por defecto si no encuentra .env
    DB_USER="bot_user"
    DB_NAME="bot_db"
    DB_HOST="localhost"
    DB_PORT="5432"
fi

PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME > ~/$BACKUP_FILE 2>/dev/null || true

if [ -f ~/$BACKUP_FILE ]; then
    print_success "Backup creado: ~/$BACKUP_FILE"
else
    print_warning "No se pudo crear el backup, pero continuando..."
fi

# Paso 3: Eliminar todas las tablas (más seguro que eliminar la base de datos completa)
print_step "Eliminando todas las tablas de la base de datos..."

# Crear script SQL para eliminar todas las tablas
cat > /tmp/drop_all_tables.sql << 'EOF'
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Eliminar todas las tablas en el schema public
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Eliminar todas las secuencias
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Eliminar todos los tipos enum
    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;
EOF

PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME < /tmp/drop_all_tables.sql

print_success "Base de datos limpiada"

# Paso 4: Eliminar el historial de migraciones de Prisma
print_step "Eliminando historial de migraciones..."
rm -rf prisma/migrations
print_success "Historial de migraciones eliminado"

# Paso 5: Crear nueva migración inicial
print_step "Creando nueva migración inicial..."
npx prisma migrate dev --name initial_migration --skip-generate
print_success "Migración inicial creada"

# Paso 6: Aplicar migraciones
print_step "Aplicando migraciones..."
npm run migrate
print_success "Migraciones aplicadas"

# Paso 7: Generar cliente Prisma
print_step "Generando cliente Prisma..."
npm run generate
print_success "Cliente Prisma generado"

# Paso 8: Generar embeddings si está configurado
if grep -q "GOOGLE_AI_API_KEY=" .env && grep -q "^GOOGLE_AI_API_KEY=." .env; then
    print_step "Generando embeddings para búsqueda semántica..."
    npm run seed:embeddings || print_warning "No se pudieron generar embeddings"
else
    print_warning "GOOGLE_AI_API_KEY no configurado, omitiendo embeddings"
fi

# Paso 9: Reiniciar servicios
print_step "Reiniciando servicios PM2..."
pm2 start ecosystem.config.js
print_success "Servicios reiniciados"

# Paso 10: Verificar estado
print_step "Verificando estado de la aplicación..."
sleep 3
pm2 status

# Resumen
echo ""
echo "================================================"
echo -e "${GREEN}¡Reset de base de datos completado!${NC}"
echo "================================================"
echo ""
echo "✅ Base de datos completamente limpia"
echo "✅ Nuevas migraciones aplicadas"
echo "✅ Servicios reiniciados"
echo ""
if [ -f ~/$BACKUP_FILE ]; then
    echo -e "${YELLOW}Backup guardado en: ~/$BACKUP_FILE${NC}"
    echo ""
    echo "Para restaurar el backup:"
    echo "PGPASSWORD=\$PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME < ~/$BACKUP_FILE"
fi
echo ""
echo "La base de datos está ahora completamente vacía."
echo "Necesitarás crear nuevos datos de prueba."
echo ""
echo "Comandos útiles:"
echo "• pm2 logs     - Ver logs"
echo "• pm2 status   - Ver estado"
echo "• pm2 monit    - Monitor en tiempo real"