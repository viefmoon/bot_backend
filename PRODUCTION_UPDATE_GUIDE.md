# 🚀 Guía de Actualización en Producción

Esta guía explica cómo actualizar tu Bot Backend en producción de manera segura y eficiente.

## 📋 Scripts Disponibles

### 1. **update-app.sh** - Actualización Estándar
- Actualiza el código desde GitHub
- Instala dependencias nuevas
- Aplica migraciones incrementales
- Mantiene todos los datos existentes
- Zero-downtime con PM2 reload

### 2. **reset-database-production.sh** - Reset Completo de BD
- **⚠️ ELIMINA TODOS LOS DATOS**
- Crea backup antes de eliminar
- Limpia completamente la base de datos
- Regenera desde cero con migraciones nuevas
- Útil para cambios estructurales mayores

### 3. **update-app-with-reset.sh** - Actualización Combinada (NUEVO)
- Combina ambas opciones en un solo script
- Modo normal: actualización estándar
- Modo `--reset-db`: actualización + reset de BD
- Interfaz unificada para ambos casos

## 🔄 Proceso de Actualización

### Actualización Normal (Recomendado)

```bash
# Conectar al servidor
ssh cloudbite@[TU-IP-DROPLET]

# Ir al directorio del proyecto
cd ~/bot_backend

# Ejecutar actualización estándar
./scripts/update-app.sh
```

**Qué hace:**
1. Guarda cambios locales si existen
2. Descarga últimos cambios de GitHub
3. Instala nuevas dependencias
4. Aplica migraciones incrementales
5. Compila el proyecto
6. Recarga servicios sin downtime
7. Verifica que todo funcione

### Actualización con Reset de BD (Cambios Mayores)

```bash
# Conectar al servidor
ssh cloudbite@[TU-IP-DROPLET]

# Ir al directorio del proyecto
cd ~/bot_backend

# Ejecutar actualización con reset
./scripts/update-app-with-reset.sh --reset-db
```

**⚠️ ADVERTENCIAS:**
- Elimina TODOS los datos
- Requiere doble confirmación
- Crea backup automático antes de proceder
- Usar solo cuando sea absolutamente necesario

## 📊 Cuándo Usar Cada Opción

### Usa Actualización Normal cuando:
- Agregues nuevas funcionalidades
- Corrijas bugs
- Agregues nuevos campos a tablas existentes
- Hagas cambios menores en el esquema
- Actualices dependencias

### Usa Reset de BD cuando:
- Cambies tipos de datos fundamentales
- Elimines tablas o relaciones complejas
- Tengas migraciones corruptas o conflictivas
- Necesites empezar desde cero en desarrollo
- Cambies la estructura base del esquema

## 🛡️ Mejores Prácticas

### Antes de Actualizar

1. **Revisa los cambios:**
   ```bash
   git fetch origin
   git log HEAD..origin/main --oneline
   ```

2. **Verifica el estado actual:**
   ```bash
   pm2 status
   pm2 logs --lines 50
   ```

3. **Considera el impacto:**
   - ¿Hay usuarios activos?
   - ¿Los cambios son breaking?
   - ¿Necesitas notificar a usuarios?

### Durante la Actualización

1. **Monitorea los logs:**
   ```bash
   # En otra terminal
   pm2 logs --lines 100
   ```

2. **Si algo sale mal:**
   ```bash
   # Revertir a commit anterior
   git reset --hard [COMMIT-ANTERIOR]
   cd backend && npm install && npm run build
   pm2 restart all
   ```

### Después de Actualizar

1. **Verifica funcionamiento:**
   ```bash
   # API Health
   curl https://cloudbiteapp.com/api/backend
   
   # Logs sin errores
   pm2 logs --err --lines 50
   
   # Métricas
   pm2 monit
   ```

2. **Prueba funcionalidades críticas:**
   - Envía mensaje de prueba al bot
   - Verifica webhook de WhatsApp
   - Confirma que el frontend carga

## 🔧 Solución de Problemas

### Error: "npm install failed"
```bash
# Limpiar cache de npm
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Error: "Migration failed"
```bash
# Ver estado de migraciones
cd backend
npx prisma migrate status

# Si hay problemas, resetear
./scripts/reset-database-production.sh
```

### Error: "PM2 process crashed"
```bash
# Ver logs detallados
pm2 logs --err --lines 200

# Reiniciar todo
pm2 delete all
cd backend && pm2 start ecosystem.config.js
```

### Error: "Port already in use"
```bash
# Encontrar proceso en puerto 5000
sudo lsof -i :5000
# Kill el proceso si es necesario
sudo kill -9 [PID]
```

## 📝 Checklist de Actualización

- [ ] Revisar cambios pendientes en GitHub
- [ ] Verificar espacio en disco: `df -h`
- [ ] Confirmar backup reciente de BD
- [ ] Ejecutar script de actualización apropiado
- [ ] Verificar logs sin errores
- [ ] Probar endpoint de health
- [ ] Enviar mensaje de prueba al bot
- [ ] Verificar que frontend carga correctamente
- [ ] Monitorear por 5-10 minutos

## 🆘 Comandos de Emergencia

```bash
# Ver todos los logs
pm2 logs

# Reiniciar todo
pm2 restart all

# Detener todo
pm2 stop all

# Estado detallado
pm2 show bot-backend-api

# Monitoreo en vivo
pm2 monit

# Restaurar backup de BD (si existe)
PGPASSWORD=$DB_PASSWORD psql -U bot_user -h localhost bot_db < ~/backup_[FECHA].sql
```

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs: `pm2 logs --err`
2. Verifica la documentación en `/CLAUDE.md`
3. Revisa issues en GitHub
4. Contacta soporte si es crítico

---

**Recuerda:** Siempre es mejor hacer actualizaciones frecuentes y pequeñas que acumular muchos cambios para una actualización grande.