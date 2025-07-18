#!/bin/bash

# Script para configurar Nginx con SSL
# Autor: Bot Backend Deployment Script
# Uso: sudo ./configure-nginx-ssl.sh

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

# Verificar root
if [[ $EUID -ne 0 ]]; then
   print_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# Configuración predefinida
DOMAIN="cloudbiteapp.com"
EMAIL="viefmoon@gmail.com"
BACKEND_PORT="5000"

echo "Configuración:"
echo "• Dominio: $DOMAIN"
echo "• Email SSL: $EMAIL"
echo "• Puerto Backend: $BACKEND_PORT"
echo ""
read -p "¿Continuar con esta configuración? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_error "Configuración cancelada"
    exit 1
fi

# Primero crear configuración temporal para obtener SSL
print_step "Creando configuración temporal de Nginx para SSL..."

cat > /etc/nginx/sites-available/bot-backend-temp <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    # Permitir validación de Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirigir todo lo demás a HTTPS (después de obtener SSL)
    location / {
        return 444;
    }
}
EOF

# Activar configuración temporal
ln -sf /etc/nginx/sites-available/bot-backend-temp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/bot-backend

# Verificar y recargar Nginx
nginx -t
systemctl reload nginx

print_success "Configuración temporal creada"

# Obtener certificado SSL
print_step "Obteniendo certificado SSL con Let's Encrypt..."

# Crear directorio para validación
mkdir -p /var/www/html

# Obtener certificado
certbot certonly --webroot -w /var/www/html -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

if [ $? -ne 0 ]; then
    print_error "Error al obtener certificado SSL"
    print_warning "Verifica que el dominio $DOMAIN apunte a este servidor"
    exit 1
fi

print_success "Certificado SSL obtenido exitosamente"

# Ahora crear la configuración completa con SSL
print_step "Creando configuración final de Nginx con SSL..."

cat > /etc/nginx/sites-available/bot-backend <<EOF
# Redirigir HTTP a HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    # Permitir validación de Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirigir todo lo demás a HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL - se configurará automáticamente con certbot
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;
    
    # Configuración de seguridad
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logs
    access_log /var/log/nginx/bot-backend-access.log;
    error_log /var/log/nginx/bot-backend-error.log;
    
    # Tamaño máximo del body (para archivos de audio, imágenes, etc.)
    client_max_body_size 25M;
    
    # Servir el frontend React
    location / {
        root /home/cloudbite/bot_backend/frontend-app/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API Backend
    location /api/ {
        # Reescribir /api/xxx a /xxx para el backend
        rewrite ^/api/(.*)\$ /\$1 break;
        
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        
        # Headers importantes
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # Timeouts para manejar conexiones largas
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # WebSocket support
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Configuración específica para el webhook de WhatsApp
    location /api/webhook {
        proxy_pass http://localhost:$BACKEND_PORT/webhook;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Importante para WhatsApp
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts específicos para webhook
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:$BACKEND_PORT/health;
        proxy_http_version 1.1;
        access_log off;
    }
    
    # Socket.IO WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Socket.IO specific
        proxy_buffering off;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

print_success "Configuración de Nginx creada"

# Desactivar configuración temporal y activar la final
print_step "Activando configuración final..."

rm -f /etc/nginx/sites-enabled/bot-backend-temp
ln -sf /etc/nginx/sites-available/bot-backend /etc/nginx/sites-enabled/

# Verificar configuración final
nginx -t

if [ $? -ne 0 ]; then
    print_error "Error en la configuración de Nginx"
    exit 1
fi

# Recargar Nginx con la configuración completa
systemctl reload nginx
print_success "Nginx configurado con SSL"

# Configurar renovación automática
print_step "Configurando renovación automática de SSL..."

# Crear directorio si no existe
mkdir -p /etc/letsencrypt/renewal-hooks/deploy/

# Crear script de renovación
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'RENEW'
#!/bin/bash
systemctl reload nginx
RENEW

chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Test renovación
certbot renew --dry-run

if [ $? -eq 0 ]; then
    print_success "Renovación automática configurada"
else
    print_warning "Renovación automática puede tener problemas, verifica manualmente"
fi

# Crear archivo de información
cat > ~/nginx_ssl_info.txt <<INFO
=====================================
NGINX Y SSL CONFIGURADOS
=====================================

Dominio: https://$DOMAIN
Backend: http://localhost:$BACKEND_PORT

Archivos de configuración:
- Nginx: /etc/nginx/sites-available/bot-backend
- SSL: /etc/letsencrypt/live/$DOMAIN/

Logs:
- Access: /var/log/nginx/bot-backend-access.log
- Error: /var/log/nginx/bot-backend-error.log

Comandos útiles:
- Test config: nginx -t
- Recargar: systemctl reload nginx
- Ver logs: tail -f /var/log/nginx/bot-backend-*.log
- Renovar SSL: certbot renew

Webhook URL para WhatsApp:
https://$DOMAIN/api/backend/webhook

=====================================
INFO

chmod 600 ~/nginx_ssl_info.txt
print_success "Información guardada en ~/nginx_ssl_info.txt"

echo ""
print_success "¡Configuración completada!"
echo ""
echo "Tu aplicación está disponible en:"
echo "Frontend: ${GREEN}https://$DOMAIN${NC}"
echo "API: ${GREEN}https://$DOMAIN/api/backend${NC}"
echo ""
echo "Webhook URL para WhatsApp: ${GREEN}https://$DOMAIN/api/backend/webhook${NC}"
echo ""
print_warning "Asegúrate de que la aplicación esté ejecutándose en el puerto $BACKEND_PORT"