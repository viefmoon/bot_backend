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

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
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
echo "6. Limpiar y recompilar el proyecto"
echo "7. Reiniciar los servicios desde cero"
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
    
    # Primero, cerrar todas las conexiones activas a la base de datos
    print_step "Cerrando conexiones activas a la base de datos..."
    sudo -u postgres psql << EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$DB_NAME'
  AND pid <> pg_backend_pid();
EOF
    
    # Intentar eliminar la base de datos
    PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || {
        print_warning "No se pudo eliminar la base de datos con usuario normal"
        
        # Intentar con sudo postgres
        print_step "Intentando eliminar con permisos de superusuario..."
        sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || {
            print_warning "No se pudo eliminar la base de datos completa"
            print_step "Usando método alternativo: eliminando TODO el contenido..."
            
            # Método alternativo mejorado: Eliminar TODO el contenido
            sudo -u postgres psql -d $DB_NAME << 'EOF'
-- Desactivar validación de foreign keys temporalmente
SET session_replication_role = 'replica';

-- Eliminar todas las vistas
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar todas las tablas (incluidas las de extensiones)
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar todas las secuencias
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_schema) || '.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- Eliminar todos los tipos (incluidos los de extensiones)
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT n.nspname, t.typname 
              FROM pg_type t 
              JOIN pg_namespace n ON n.oid = t.typnamespace 
              WHERE n.nspname = 'public' 
              AND t.typtype IN ('c', 'e', 'd', 'r')) LOOP
        BEGIN
            EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.typname) || ' CASCADE';
        EXCEPTION WHEN others THEN
            -- Ignorar errores de tipos que no se pueden eliminar
            NULL;
        END;
    END LOOP;
END $$;

-- Eliminar todas las funciones
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
              AND p.prokind = 'f') LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        EXCEPTION WHEN others THEN
            -- Ignorar errores de funciones que no se pueden eliminar
            NULL;
        END;
    END LOOP;
END $$;

-- Eliminar todos los procedimientos almacenados
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
              AND p.prokind = 'p') LOOP
        BEGIN
            EXECUTE 'DROP PROCEDURE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        EXCEPTION WHEN others THEN
            NULL;
        END;
    END LOOP;
END $$;

-- Eliminar todos los triggers
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT DISTINCT trigger_name, event_object_table 
              FROM information_schema.triggers 
              WHERE trigger_schema = 'public') LOOP
        BEGIN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || quote_ident(r.event_object_table) || ' CASCADE';
        EXCEPTION WHEN others THEN
            NULL;
        END;
    END LOOP;
END $$;

-- Eliminar todas las extensiones excepto plpgsql
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT extname FROM pg_extension WHERE extname != 'plpgsql') LOOP
        EXECUTE 'DROP EXTENSION IF EXISTS ' || quote_ident(r.extname) || ' CASCADE';
    END LOOP;
END $$;

-- Reactivar validación de foreign keys
SET session_replication_role = 'origin';

-- Verificar que todo se eliminó
SELECT 'Tablas restantes: ' || count(*) FROM pg_tables WHERE schemaname = 'public';
SELECT 'Tipos restantes: ' || count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype IN ('c', 'e');
SELECT 'Funciones restantes: ' || count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';
EOF
            
            print_success "Contenido de la base de datos eliminado"
        }
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
        
        # Si se creó con postgres, dar permisos completos al usuario
        sudo -u postgres psql -d $DB_NAME << EOF
-- Dar permisos completos en el esquema public
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;

-- Crear extensión vector si es necesaria
CREATE EXTENSION IF NOT EXISTS vector;
EOF
        
        print_success "Permisos configurados correctamente"
    }
    
    print_success "Base de datos creada"
fi

# Verificar y configurar permisos antes de aplicar migración
print_step "Configurando permisos y extensiones necesarias..."

# Siempre ejecutar esto para asegurar que todo esté configurado correctamente
sudo -u postgres psql << EOF
-- Conectar a la base de datos
\c $DB_NAME

-- Dar permisos completos al usuario
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;

-- Crear extensión vector (requerida para embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Dar permisos de creación de bases de datos al usuario (útil para futuros resets)
ALTER USER $DB_USER CREATEDB;
EOF

print_success "Permisos y extensiones configurados correctamente"

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

# Paso 8: Limpiar y recompilar el backend
print_step "Limpiando código compilado del backend..."
rm -rf dist/
print_success "Código compilado del backend eliminado"
print_info "Esto previene errores de código obsoleto en el cache"

print_step "Recompilando backend TypeScript..."
npm run build
print_success "Backend recompilado con código actualizado"

# Paso 8.5: Compilar el frontend si existe
if [ -d "$HOME/bot_backend/frontend-app" ]; then
    print_step "Compilando frontend desde cero..."
    cd ~/bot_backend/frontend-app
    
    # Limpiar build anterior
    print_step "Limpiando build anterior del frontend..."
    rm -rf dist/ .next/ build/
    print_success "Build anterior del frontend eliminado"
    
    # Instalar dependencias del frontend si es necesario
    if [ ! -d "node_modules" ] || [ ! -s "node_modules" ]; then
        print_step "Instalando dependencias del frontend..."
        npm install
        print_success "Dependencias del frontend instaladas"
    fi
    
    # Compilar frontend
    print_step "Ejecutando build del frontend..."
    npm run build
    print_success "Frontend compilado exitosamente"
    
    # Volver al directorio backend
    cd ~/bot_backend/backend
else
    print_warning "No se encontró directorio frontend-app, saltando compilación del frontend"
fi

# Paso 9: Generar embeddings si está configurado
if grep -q "GOOGLE_AI_API_KEY=" .env && grep -q "^GOOGLE_AI_API_KEY=." .env; then
    print_step "Preparando generación de embeddings..."
    print_info "Los embeddings se generarán automáticamente después de la primera sincronización del menú"
    print_info "También puedes generarlos manualmente con: npm run seed:embeddings"
else
    print_warning "GOOGLE_AI_API_KEY no configurado, búsqueda semántica deshabilitada"
fi

# Paso 10: Detener servicios existentes completamente
print_step "Deteniendo servicios PM2 existentes..."
pm2 delete all 2>/dev/null || true
print_success "Servicios detenidos y eliminados"

# Paso 11: Iniciar servicios limpios
print_step "Iniciando servicios PM2 desde cero..."
pm2 start ecosystem.config.js
print_success "Servicios iniciados"

# Paso 12: Verificar estado
print_step "Verificando estado de la aplicación..."
sleep 5
pm2 status

# Resumen
echo ""
echo "================================================"
echo -e "${GREEN}¡Reset de base de datos completado!${NC}"
echo "================================================"
echo ""
echo "✅ Base de datos completamente limpia"
echo "✅ Nuevas migraciones aplicadas"
echo "✅ Backend recompilado (sin código antiguo)"
echo "✅ Frontend compilado desde cero"
echo "✅ Servicios reiniciados desde cero"
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