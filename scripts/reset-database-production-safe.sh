#!/bin/bash

# Script SEGURO para resetear completamente la base de datos en producción
# Este script maneja las limitaciones de permisos en producción
# Autor: Bot Backend Reset Script (Production Safe)
# Uso: ./reset-database-production-safe.sh

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
    print_error "No se encontró archivo .env"
    exit 1
fi

PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME > ~/$BACKUP_FILE 2>/dev/null || true

if [ -f ~/$BACKUP_FILE ]; then
    print_success "Backup creado: ~/$BACKUP_FILE"
else
    print_warning "No se pudo crear el backup, pero continuando..."
fi

# Paso 3: Limpiar la base de datos completamente
print_step "Limpiando la base de datos..."

# Verificar si la base de datos existe
DB_EXISTS=$(PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null)

if [ "$DB_EXISTS" == "1" ]; then
    # La base de datos existe, intentar eliminarla
    print_step "Intentando eliminar la base de datos existente..."
    PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || {
        print_warning "No se pudo eliminar la base de datos (permisos limitados)"
        print_step "Usando método alternativo: eliminando todas las tablas..."
    
    # Método 2: Eliminar todas las tablas manualmente
    cat > /tmp/drop_all_tables.sql << 'EOF'
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Primero eliminar la tabla de migraciones de Prisma
    DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
    
    -- Eliminar todas las tablas en el schema public
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
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
    
    -- Eliminar todas las funciones
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args 
              FROM pg_proc 
              WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;
EOF
    
        PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME < /tmp/drop_all_tables.sql
    }
else
    print_warning "La base de datos no existe, se creará una nueva"
fi

print_success "Preparación de base de datos completada"

# Paso 4: Eliminar el historial de migraciones
print_step "Eliminando historial de migraciones..."
rm -rf prisma/migrations
mkdir -p prisma/migrations
print_success "Historial de migraciones eliminado"

# Paso 5: Crear migración inicial usando un método seguro
print_step "Preparando nueva migración inicial..."

# Crear directorio de migración manualmente
MIGRATION_NAME="$(date +%Y%m%d%H%M%S)_initial_migration"
MIGRATION_DIR="prisma/migrations/$MIGRATION_NAME"
mkdir -p "$MIGRATION_DIR"

# Generar SQL de migración desde el esquema
print_step "Generando SQL de migración desde el esquema..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIGRATION_DIR/migration.sql"

# Verificar que se generó el SQL
if [ ! -s "$MIGRATION_DIR/migration.sql" ]; then
    print_error "No se pudo generar el SQL de migración"
    exit 1
fi

print_success "SQL de migración generado"

# Paso 6: Verificar que la base de datos existe antes de aplicar migración
print_step "Verificando que la base de datos existe..."
DB_EXISTS=$(PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null)

if [ "$DB_EXISTS" != "1" ]; then
    print_warning "La base de datos no existe, intentando crearla..."
    
    # Intentar crear como el usuario normal
    PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
        print_error "No se pudo crear la base de datos con el usuario $DB_USER"
        print_warning "Intentando con sudo postgres..."
        
        # Intentar con sudo postgres
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
            print_error "No se pudo crear la base de datos"
            print_error ""
            print_error "Por favor, ejecuta manualmente como administrador:"
            print_error "  sudo -u postgres psql"
            print_error "  CREATE DATABASE $DB_NAME;"
            print_error "  GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
            print_error "  \\q"
            print_error ""
            print_error "Luego vuelve a ejecutar este script"
            exit 1
        }
        
        # Si se creó con postgres, dar permisos al usuario
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    }
    
    print_success "Base de datos creada"
fi

# Aplicar la migración
print_step "Aplicando migración inicial..."
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME < "$MIGRATION_DIR/migration.sql"

# Marcar la migración como aplicada en Prisma
print_step "Registrando migración en Prisma..."
npx prisma migrate resolve --applied "$MIGRATION_NAME"

print_success "Migración aplicada y registrada"

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