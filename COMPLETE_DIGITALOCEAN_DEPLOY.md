# 🚀 Guía de Despliegue en DigitalOcean - cloudbiteapp.com

Esta guía te llevará desde cero hasta tener tu Bot Backend y Frontend funcionando en producción.

## 📋 Tabla de Contenidos

1. [Crear Droplet en DigitalOcean](#1-crear-droplet-en-digitalocean)
2. [Configuración DNS](#2-configuración-dns)
3. [Acceso Inicial al Servidor](#3-acceso-inicial-al-servidor)
4. [Instalación Automática](#4-instalación-automática)
5. [Configuración Post-Instalación](#5-configuración-post-instalación)
6. [Verificación y Pruebas](#6-verificación-y-pruebas)
7. [Mantenimiento](#7-mantenimiento)

---

## 1. Crear Droplet en DigitalOcean

### 📦 Especificaciones Recomendadas

1. **Inicia sesión** en [DigitalOcean](https://www.digitalocean.com)

2. **Crea un nuevo Droplet** con estas especificaciones:
   - **Imagen**: Ubuntu 24.04 (LTS) x64
   - **Plan**: 
     - Mínimo: Basic - Regular Intel - $24/mes (4GB RAM, 2 vCPUs)
     - Recomendado: Basic - Regular Intel - $48/mes (8GB RAM, 4 vCPUs)
   - **Datacenter**: El más cercano a tus usuarios
   - **Autenticación**: SSH Keys (recomendado) o Password
   - **Hostname**: `bot-cloudbite`

3. **Opciones adicionales** (recomendadas):
   - ✅ IPv6
   - ✅ Monitoring
   - ✅ Backups (+20% del costo mensual)

4. **Crea el Droplet** y espera ~1 minuto

---

## 2. Configuración DNS

### 🌐 En DigitalOcean

> **Importante**: La configuración de dominios NO se hace desde la página del Droplet

1. **Acceder a la sección de dominios:**
   - En el panel lateral izquierdo, haz clic en **"Networking"**
   - Luego selecciona **"Domains"** en la parte superior
   - O accede directamente a: `https://cloud.digitalocean.com/networking/domains`

2. **Agregar tu dominio:**
   - Haz clic en el botón **"Add Domain"**
   - Ingresa: `cloudbiteapp.com`
   - Selecciona tu droplet de la lista desplegable (aparecerá con su IP)
   - Haz clic en **"Add Domain"**

3. **Registros DNS creados automáticamente:**
   ```
   Tipo    Hostname    Value               TTL
   A       @          [IP-DEL-DROPLET]    3600
   A       www        [IP-DEL-DROPLET]    3600
   NS      @          ns1.digitalocean.com
   NS      @          ns2.digitalocean.com
   NS      @          ns3.digitalocean.com
   ```

### 🌐 En Namecheap (tu registrador de dominio)

1. **Inicia sesión** en tu cuenta de [Namecheap](https://www.namecheap.com)

2. **Accede a la gestión del dominio:**
   - En el Dashboard, busca `cloudbiteapp.com`
   - Haz clic en el botón **"MANAGE"** al lado del dominio

3. **Cambiar los nameservers:**
   - En la pestaña **"Domain"**
   - Busca la sección **"NAMESERVERS"**
   - Selecciona **"Custom DNS"** del menú desplegable
   - Ingresa los nameservers de DigitalOcean:
     ```
     ns1.digitalocean.com
     ns2.digitalocean.com
     ns3.digitalocean.com
     ```
   - Haz clic en el ✓ (check verde) para guardar

4. **Verificar el cambio:**
   - Deberías ver un mensaje de confirmación
   - Los nameservers ahora mostrarán los de DigitalOcean

> ⏱️ **Nota**: Los cambios DNS pueden tardar hasta 48 horas en propagarse, aunque normalmente toman 15-30 minutos. Puedes verificar la propagación en [whatsmydns.net](https://www.whatsmydns.net/)

---

## 3. Acceso Inicial al Servidor

### 🔐 Conexión SSH

**Windows (PowerShell/Terminal):**
```bash
ssh root@[IP-DEL-DROPLET]
```

**Mac/Linux:**
```bash
ssh root@[IP-DEL-DROPLET]
```

Si usaste contraseña, te la pedirá. Si usaste SSH key, conectará automáticamente.

### 🛡️ Seguridad Inicial (Opcional pero Recomendado)

```bash
# Cambiar contraseña root
passwd

# Crear usuario no-root (mismo nombre que el dominio para consistencia)
adduser cloudbite
usermod -aG sudo cloudbite

# Copiar SSH keys al nuevo usuario
rsync --archive --chown=cloudbite:cloudbite ~/.ssh /home/cloudbite
```

---

## 4. Instalación Automática

### 🎯 Opción A: Script Todo-en-Uno (Recomendado)

Ejecuta este comando único que instalará todo automáticamente:

```bash
wget https://raw.githubusercontent.com/viefmoon/bot_backend/main/scripts/quick-deploy.sh && chmod +x quick-deploy.sh && sudo ./quick-deploy.sh
```

> **Nota**: Si durante la actualización del sistema aparece un diálogo sobre `/etc/ssh/sshd_config`, selecciona **"keep the local version currently installed"** (mantener versión local)

El script automáticamente:
- ✅ Actualiza el sistema
- ✅ Instala Node.js 20, PostgreSQL 15, Redis, Nginx
- ✅ Configura la base de datos con pgvector
- ✅ Clona tu repositorio
- ✅ Instala dependencias del backend y frontend
- ✅ Construye el frontend React para producción
- ✅ Configura SSL con Let's Encrypt
- ✅ Configura Nginx para servir frontend y API
- ✅ Prepara PM2 para gestión de procesos

### 🎯 Opción B: Instalación Manual Paso a Paso

Si prefieres ver qué hace cada paso:

```bash
# 1. Instalar dependencias del sistema
wget https://raw.githubusercontent.com/viefmoon/bot_backend/main/scripts/install-dependencies.sh
chmod +x install-dependencies.sh
sudo ./install-dependencies.sh

# 2. Configurar base de datos
wget https://raw.githubusercontent.com/viefmoon/bot_backend/main/scripts/setup-database.sh
chmod +x setup-database.sh
sudo ./setup-database.sh

# 3. Cambiar al usuario de la aplicación
su - cloudbite

# 4. Clonar y configurar aplicación
git clone https://github.com/viefmoon/bot_backend.git
cd bot_backend
./scripts/setup-app.sh

# 5. Configurar Nginx + SSL
exit  # Volver a root
cd /home/cloudbite/bot_backend
sudo ./scripts/configure-nginx-ssl.sh
```

---

## 5. Configuración Post-Instalación

### 🔧 Configurar Variables de Entorno

1. **Cambiar al usuario de la aplicación:**
   ```bash
   su - cloudbite
   ```

2. **Editar el archivo .env:**
   ```bash
   cd ~/bot_backend/backend
   nano .env
   ```

3. **Actualizar estas variables con tus valores reales:**

   ```env
   # Google AI - REQUERIDO
   GOOGLE_AI_API_KEY=tu_api_key_de_google_ai
   
   # WhatsApp Business API - REQUERIDO
   WHATSAPP_PHONE_NUMBER_MESSAGING_ID=tu_phone_number_id
   WHATSAPP_ACCESS_TOKEN=tu_access_token_de_whatsapp
   WHATSAPP_VERIFY_TOKEN=un_token_secreto_que_tu_elijas
   
   # Opcional: Stripe (si usas pagos)
   STRIPE_SECRET_KEY=tu_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=tu_stripe_webhook_secret
   ```

   > 💡 **Tip**: Presiona `Ctrl+O` para guardar, `Enter` para confirmar, `Ctrl+X` para salir

### 📊 Ejecutar Migraciones de Base de Datos

```bash
# Asegúrate de estar en el directorio backend
cd ~/bot_backend/backend

# Ejecutar migraciones
npm run migrate

# Generar embeddings para búsqueda semántica (recomendado)
npm run seed:embeddings
```

### 🚀 Iniciar la Aplicación

```bash
# Iniciar con PM2
npm run pm2:start

# Verificar que esté ejecutándose
pm2 status
```

Deberías ver algo así:
```
┌─────┬────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name               │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ bot-backend-api    │ default     │ 1.0.0   │ fork    │ 12345    │ 0s     │ 0    │ online    │ 0%       │ 45.2mb   │ appuser  │ disabled │
│ 1   │ bot-backend-worker │ default     │ 1.0.0   │ cluster │ 12346    │ 0s     │ 0    │ online    │ 0%       │ 42.1mb   │ appuser  │ disabled │
└─────┴────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 6. Verificación y Pruebas

### ✅ Verificar Estado del Sistema

```bash
cd ~/bot_backend
./scripts/health-check.sh
```

### 🌐 Probar la API y Frontend

1. **API Backend:**
   ```bash
   curl http://localhost:5000/backend
   ```
   - También visita: https://cloudbiteapp.com/api/backend
   - Deberías ver: `{"message":"Bot Backend API is running","version":"2.0.0","timestamp":"..."}`

2. **Frontend React:**
   - Visita: https://cloudbiteapp.com
   - Deberías ver tu aplicación React funcionando

3. **WebSocket (Socket.IO):**
   ```bash
   curl https://cloudbiteapp.com/socket.io/\?EIO\=4\&transport\=polling
   ```
   - Deberías ver una respuesta JSON con `sid` y configuración de Socket.IO

### 📱 Configurar WhatsApp Webhook

1. Ve a [Meta for Developers](https://developers.facebook.com)
2. Selecciona tu app de WhatsApp
3. En **Configuration** → **Webhooks**:
   - **Callback URL**: `https://cloudbiteapp.com/api/backend/webhook`
   - **Verify Token**: El valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
4. Suscríbete a los eventos: `messages`

### 📊 Monitorear Logs

```bash
# Ver todos los logs
pm2 logs

# Ver logs de la API
pm2 logs bot-backend-api

# Ver logs del worker
pm2 logs bot-backend-worker

# Monitoreo en tiempo real
pm2 monit
```

---

## 7. Mantenimiento

### 🔄 Actualizar la Aplicación

```bash
cd ~/bot_backend
./scripts/update-app.sh
```

### 📊 Comandos Útiles de PM2

```bash
# Estado de procesos
pm2 status

# Reiniciar todo
pm2 restart all

# Detener todo
pm2 stop all

# Recargar sin downtime
pm2 reload all

# Ver uso de CPU/Memoria
pm2 monit
```

### 🗄️ Backup de Base de Datos

```bash
# Backup manual
pg_dump -U bot_user bot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -U bot_user bot_db < backup_20240101_120000.sql
```

### 🔒 Renovar SSL (Automático)

El certificado SSL se renueva automáticamente. Para verificar:

```bash
sudo certbot certificates
```

Para renovar manualmente:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 🆘 Solución de Problemas Comunes

### ❌ La API no responde

```bash
# Verificar logs
pm2 logs --lines 100

# Reiniciar servicios
pm2 restart all

# Verificar puerto
sudo netstat -tlnp | grep 5000
```

### ❌ Error de conexión a PostgreSQL

```bash
# Verificar estado
sudo systemctl status postgresql

# Ver logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Reiniciar
sudo systemctl restart postgresql
```

### ❌ Error de Redis

```bash
# Verificar estado
sudo systemctl status redis-server

# Test conexión
redis-cli ping

# Reiniciar
sudo systemctl restart redis-server
```

### ❌ Nginx no funciona

```bash
# Verificar configuración
sudo nginx -t

# Ver logs de error
sudo tail -f /var/log/nginx/error.log

# Reiniciar
sudo systemctl restart nginx
```

---

## 📞 Información de Contacto

- **Dominio**: https://cloudbiteapp.com
- **Email**: viefmoon@gmail.com
- **Repositorio**: https://github.com/viefmoon/bot_backend

---

## 🎉 ¡Felicidades!

Tu Bot Backend está ahora funcionando en producción. 

### Próximos pasos recomendados:

1. **Configura alertas** en DigitalOcean para monitorear CPU/RAM
2. **Activa backups automáticos** en el panel de DigitalOcean
3. **Configura un firewall** adicional si manejas datos sensibles
4. **Prueba el webhook** enviando un mensaje de WhatsApp

### Comandos de verificación final:

```bash
# Todo en una vista
echo "=== ESTADO DEL SISTEMA ==="
pm2 status
echo -e "\n=== HEALTH CHECK ==="
curl -s http://localhost:5000/backend | jq
echo -e "\n=== ÚLTIMOS LOGS ==="
pm2 logs --nostream --lines 5
echo -e "\n=== URL DE TU BOT ==="
echo "https://cloudbiteapp.com"
```

### 🔌 Conexión WebSocket para Sincronización

Para conectarte al WebSocket de sincronización:

**URL del WebSocket:**
```
wss://cloudbiteapp.com/socket.io/
```

**Ejemplo con Socket.IO Client (JavaScript):**
```javascript
const socket = io('https://cloudbiteapp.com', {
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Conectado al WebSocket');
});

socket.on('sync:update', (data) => {
  console.log('Actualización de sincronización:', data);
});
```

**Verificar conexión:**
```bash
curl https://cloudbiteapp.com/socket.io/\?EIO\=4\&transport\=polling
```

¡Tu bot está listo para recibir mensajes! 🚀