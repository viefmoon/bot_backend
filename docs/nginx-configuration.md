# Nginx Configuration for Bot Backend

This document provides the complete Nginx configuration for the Bot Backend application.

## Important Routes

The application uses the following routing structure:

1. **Frontend (React)**: `/` - Serves the React application
2. **API Routes**: `/api/*` - Proxies to backend API (strips `/api` prefix)
3. **Backend Routes**: `/backend/*` - Proxies to backend API (preserves `/backend` prefix)
4. **WebSocket**: `/socket.io/*` - WebSocket connections for real-time updates
5. **WhatsApp Webhook**: `/api/backend/webhook` - Special route for WhatsApp webhook

## Complete Nginx Configuration

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name cloudbiteapp.com;
    
    # Allow Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect everything else to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cloudbiteapp.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/cloudbiteapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloudbiteapp.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/cloudbiteapp.com/chain.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logs
    access_log /var/log/nginx/bot-backend-access.log;
    error_log /var/log/nginx/bot-backend-error.log;
    
    # Max body size for file uploads
    client_max_body_size 25M;
    
    # Serve React frontend
    location / {
        root /home/cloudbite/bot_backend/frontend-app/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API Backend - strips /api prefix
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Important headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # WebSocket support
        proxy_cache_bypass $http_upgrade;
    }
    
    # Backend routes - preserves /backend prefix
    # Used for address-registration, address-selection, etc.
    location /backend/ {
        proxy_pass http://localhost:5000/backend/;
        proxy_http_version 1.1;
        
        # Important headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WhatsApp webhook
    location /api/webhook {
        proxy_pass http://localhost:5000/webhook;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important for WhatsApp
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Webhook-specific timeouts
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_http_version 1.1;
        access_log off;
    }
    
    # Socket.IO WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Socket.IO specific
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Key Points

1. **Frontend Routes**: All routes not matching specific locations serve the React app
2. **API Routes**: `/api/*` routes strip the `/api` prefix before proxying
3. **Backend Routes**: `/backend/*` routes preserve the prefix (required for address-registration)
4. **WebSocket Support**: Full WebSocket support for Socket.IO connections
5. **Security**: Modern SSL configuration with security headers
6. **File Permissions**: Ensure proper permissions (755) for directories accessed by www-data

## Troubleshooting

### Permission Denied Errors
If you see "Permission denied" errors in Nginx logs:
```bash
chmod 755 /home/cloudbite
chmod 755 /home/cloudbite/bot_backend
chmod 755 /home/cloudbite/bot_backend/frontend-app
chmod -R 755 /home/cloudbite/bot_backend/frontend-app/dist
```

### Testing Routes
```bash
# Test API route
curl https://cloudbiteapp.com/api/backend

# Test backend route
curl https://cloudbiteapp.com/backend/address-registration/delivery-area

# Test WebSocket
curl https://cloudbiteapp.com/socket.io/\?EIO\=4\&transport\=polling
```