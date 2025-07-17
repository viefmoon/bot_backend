#!/bin/bash

# Script para configurar PostgreSQL y crear la base de datos
# Autor: Bot Backend Deployment Script
# Uso: sudo ./setup-database.sh

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

# Verificar que se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   print_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# Solicitar información
read -p "Nombre de usuario para la base de datos (default: bot_user): " DB_USER
DB_USER=${DB_USER:-bot_user}

read -sp "Contraseña para el usuario $DB_USER: " DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
    print_error "La contraseña no puede estar vacía"
    exit 1
fi

read -p "Nombre de la base de datos (default: bot_db): " DB_NAME
DB_NAME=${DB_NAME:-bot_db}

print_step "Configurando PostgreSQL..."

# Crear usuario y base de datos
sudo -u postgres psql <<EOF
-- Verificar si el usuario existe antes de crearlo
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Verificar si la base de datos existe antes de crearla
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Otorgar todos los privilegios
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Conectar a la base de datos y crear la extensión pgvector
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

print_success "Base de datos configurada correctamente"

# Verificar la configuración de PostgreSQL
print_step "Verificando configuración de PostgreSQL..."

# Obtener la versión de PostgreSQL
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1 | cut -d. -f1)

# Configurar pg_hba.conf para permitir conexiones locales
PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"

if [ -d "$PG_CONFIG_DIR" ]; then
    # Hacer backup del archivo original
    cp "$PG_CONFIG_DIR/pg_hba.conf" "$PG_CONFIG_DIR/pg_hba.conf.backup"
    
    # Asegurar que permite conexiones locales con md5
    if ! grep -q "local   all             $DB_USER" "$PG_CONFIG_DIR/pg_hba.conf"; then
        echo "local   all             $DB_USER                                md5" >> "$PG_CONFIG_DIR/pg_hba.conf"
    fi
    
    # Reiniciar PostgreSQL
    systemctl restart postgresql
    print_success "Configuración de PostgreSQL actualizada"
else
    print_warning "No se pudo encontrar el directorio de configuración de PostgreSQL"
fi

# Probar la conexión
print_step "Probando conexión a la base de datos..."
export PGPASSWORD=$DB_PASSWORD
if psql -U $DB_USER -h localhost -d $DB_NAME -c '\q' 2>/dev/null; then
    print_success "Conexión exitosa a la base de datos"
else
    print_error "No se pudo conectar a la base de datos"
    print_warning "Verifica la configuración en pg_hba.conf"
fi
unset PGPASSWORD

# Crear archivo con la cadena de conexión
print_step "Guardando información de conexión..."
cat > ~/db_connection_info.txt <<EOF
=================================
INFORMACIÓN DE CONEXIÓN A LA BASE DE DATOS
=================================

Base de datos: $DB_NAME
Usuario: $DB_USER
Puerto: 5432

Cadena de conexión para .env:
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

IMPORTANTE: Guarda esta información de forma segura y elimina este archivo después de usarlo.
=================================
EOF

chmod 600 ~/db_connection_info.txt
print_success "Información guardada en ~/db_connection_info.txt"

echo ""
print_success "¡Configuración de base de datos completada!"
echo ""
print_warning "IMPORTANTE:"
echo "1. La información de conexión se guardó en ~/db_connection_info.txt"
echo "2. Copia la cadena DATABASE_URL a tu archivo .env"
echo "3. Elimina el archivo db_connection_info.txt después de usarlo"
echo ""
echo "Cadena de conexión:"
echo -e "${GREEN}DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME${NC}"