#!/bin/bash

# Script de despliegue rápido completo
# Autor: Bot Backend Deployment Script  
# Uso: Ejecutar desde un servidor Ubuntu 24.04 LTS limpio
# wget https://raw.githubusercontent.com/viefmoon/bot_backend/main/scripts/quick-deploy.sh && chmod +x quick-deploy.sh && sudo ./quick-deploy.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Función para imprimir con color
print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
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

print_header() {
    echo -e "\n${MAGENTA}==========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}==========================================${NC}\n"
}

# Verificar que se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   print_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

clear
print_header "BOT BACKEND - INSTALACIÓN RÁPIDA"

# Configuración predefinida
APP_USER="cloudbite"
GIT_REPO="https://github.com/viefmoon/bot_backend.git"
DOMAIN="cloudbiteapp.com"
SSL_EMAIL="viefmoon@gmail.com"

echo "Configuración de despliegue:"
echo ""
echo "• Usuario de aplicación: $APP_USER"
echo "• Repositorio: $GIT_REPO"
echo "• Dominio: $DOMAIN"
echo "• Email SSL: $SSL_EMAIL"
echo ""
read -p "¿Deseas continuar con esta configuración? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_error "Despliegue cancelado"
    exit 1
fi

# Paso 1: Actualizar sistema e instalar dependencias
print_header "PASO 1: INSTALANDO DEPENDENCIAS DEL SISTEMA"

# Configurar para mantener archivos de configuración locales durante actualizaciones
export DEBIAN_FRONTEND=noninteractive

apt update
apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt install -y curl wget git build-essential software-properties-common

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
print_success "Node.js instalado"

# PostgreSQL
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-15 postgresql-contrib-15 postgresql-15-pgvector
print_success "PostgreSQL instalado"

# Redis
apt install -y redis-server
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server
print_success "Redis instalado"

# PM2
npm install -g pm2
print_success "PM2 instalado"

# Nginx
apt install -y nginx
print_success "Nginx instalado"

# Certbot
apt install -y certbot python3-certbot-nginx
print_success "Certbot instalado"

# Paso 2: Crear usuario y estructura
print_header "PASO 2: CONFIGURANDO USUARIO Y PROYECTO"

# Crear usuario si no existe
if ! id "$APP_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" $APP_USER
    print_success "Usuario $APP_USER creado"
else
    print_success "Usuario $APP_USER ya existe"
fi

# Configurar sudoers para PM2
echo "$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/pm2" >> /etc/sudoers.d/pm2

# Paso 3: Configurar base de datos
print_header "PASO 3: CONFIGURANDO BASE DE DATOS"

# Generar contraseña segura
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
DB_USER="bot_user"
DB_NAME="bot_db"

sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

print_success "Base de datos configurada"

# Paso 4: Clonar y configurar aplicación
print_header "PASO 4: INSTALANDO APLICACIÓN"

# Cambiar al usuario de la app
su - $APP_USER <<EOF
# Clonar repositorio
git clone $GIT_REPO ~/bot_backend
cd ~/bot_backend/backend

# Instalar dependencias del backend
npm install --production

# Instalar y construir frontend
cd ../frontend-app
npm install
npm run build || print_warning "Frontend build tuvo errores, pero continuando..."

# Volver al backend y crear archivo .env
cd ../backend
cat > .env <<ENV_FILE
# Base de datos
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Google AI - ACTUALIZAR
GOOGLE_AI_API_KEY=ACTUALIZAR_CON_TU_API_KEY
GEMINI_MODEL=gemini-2.5-pro
EMBEDDING_MODEL=text-embedding-004

# WhatsApp Business API - ACTUALIZAR
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=ACTUALIZAR_CON_TU_ID
WHATSAPP_ACCESS_TOKEN=ACTUALIZAR_CON_TU_TOKEN
WHATSAPP_VERIFY_TOKEN=ACTUALIZAR_CON_TU_VERIFY_TOKEN

# URLs de producción
FRONTEND_BASE_URL=https://$DOMAIN
NODE_ENV=production
PORT=5000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Workers
BULLMQ_WORKER_CONCURRENCY=10
NUM_WORKERS=2

# Cloud API
CLOUD_API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Configuración regional
DEFAULT_TIMEZONE=America/Mexico_City
DEFAULT_LOCALE=es-MX

# Rate limiting
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5
ENV_FILE

# Generar Prisma client
npm run generate

# Compilar (permitir continuar si hay errores de tipos)
npm run build || print_warning "Build del backend tuvo errores de tipos, pero continuando..."

# Configurar PM2
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER || true
EOF

print_success "Aplicación instalada"

# Paso 5: Configurar Nginx
print_header "PASO 5: CONFIGURANDO NGINX"

cat > /etc/nginx/sites-available/bot-backend <<NGINX_CONF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts para WhatsApp
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /webhook {
        proxy_pass http://localhost:5000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/bot-backend /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

print_success "Nginx configurado"

# Paso 6: Configurar SSL
print_header "PASO 6: CONFIGURANDO SSL"

certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive

print_success "SSL configurado"

# Paso 7: Configurar firewall
print_header "PASO 7: CONFIGURANDO FIREWALL"

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

print_success "Firewall configurado"

# Crear script de información
cat > /home/$APP_USER/deployment_info.txt <<INFO
==========================================
INFORMACIÓN DE DESPLIEGUE - BOT BACKEND
==========================================

DOMINIO: https://$DOMAIN

BASE DE DATOS:
- Usuario: $DB_USER
- Contraseña: $DB_PASSWORD
- Base de datos: $DB_NAME
- Connection String: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

APLICACIÓN:
- Usuario: $APP_USER
- Directorio: /home/$APP_USER/bot_backend
- Puerto: 5000

IMPORTANTE - PRÓXIMOS PASOS:
1. Editar /home/$APP_USER/bot_backend/backend/.env con tus credenciales reales:
   - GOOGLE_AI_API_KEY
   - WHATSAPP_PHONE_NUMBER_MESSAGING_ID
   - WHATSAPP_ACCESS_TOKEN
   - WHATSAPP_VERIFY_TOKEN

2. Ejecutar migraciones:
   su - $APP_USER
   cd ~/bot_backend/backend
   npm run migrate
   npm run seed:embeddings (opcional)

3. Iniciar la aplicación:
   npm run pm2:start

4. Verificar logs:
   pm2 logs

COMANDOS ÚTILES:
- Ver estado: pm2 status
- Reiniciar: pm2 restart all
- Ver logs: pm2 logs
- Actualizar: cd ~/bot_backend && git pull && cd backend && npm install && npm run build && pm2 reload all

==========================================
INFO

chown $APP_USER:$APP_USER /home/$APP_USER/deployment_info.txt
chmod 600 /home/$APP_USER/deployment_info.txt

# Resumen final
print_header "¡INSTALACIÓN COMPLETADA!"

echo -e "${GREEN}La instalación base se ha completado exitosamente.${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE - Acciones requeridas:${NC}"
echo ""
echo "1. Conéctate como el usuario de la aplicación:"
echo -e "   ${BLUE}su - $APP_USER${NC}"
echo ""
echo "2. Edita el archivo .env con tus credenciales:"
echo -e "   ${BLUE}cd ~/bot_backend/backend && nano .env${NC}"
echo ""
echo "3. Ejecuta las migraciones de base de datos:"
echo -e "   ${BLUE}npm run migrate${NC}"
echo ""
echo "4. Inicia la aplicación:"
echo -e "   ${BLUE}npm run pm2:start${NC}"
echo ""
echo "5. Configura el webhook en Meta Business:"
echo -e "   URL: ${GREEN}https://$DOMAIN/webhook${NC}"
echo ""
echo -e "${YELLOW}La información de despliegue se guardó en:${NC}"
echo -e "${BLUE}/home/$APP_USER/deployment_info.txt${NC}"
echo ""
echo -e "${GREEN}¡Tu servidor está listo!${NC}"