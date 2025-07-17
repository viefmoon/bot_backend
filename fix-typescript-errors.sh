#!/bin/bash

echo "Corrigiendo errores de TypeScript..."

# 1. Corregir audioHealth.controller.ts - cambiar tipo de services
echo "Corrigiendo audioHealth.controller.ts..."
sed -i '21,26s/const services = {/const services: HealthCheckResponse["services"] = {/' backend/src/api/audio/audioHealth.controller.ts
sed -i 's/as const//g' backend/src/api/audio/audioHealth.controller.ts
sed -i 's/embedding: { not: null }/embeddingVector: { not: null }/' backend/src/api/audio/audioHealth.controller.ts

# 2. Corregir messageQueue.ts - orden de parámetros de Redis
echo "Corrigiendo messageQueue.ts..."
sed -i "s/redisClient.set(lockKey, 'processing', 'NX', 'EX', timeoutSeconds)/redisClient.set(lockKey, 'processing', 'EX', timeoutSeconds, 'NX')/" backend/src/queues/messageQueue.ts

# 3. Corregir address-registration.ts
echo "Corrigiendo address-registration.ts..."
# Cambiar la línea para extraer address del body correctamente
sed -i '201s/const { address } = req.body as UpdateAddressDto;/const address = req.body as UpdateAddressDto;/' backend/src/routes/address-registration.ts

# 4. Agregar LOCAL_BACKEND_URL al tipo EnvironmentVariables
echo "Corrigiendo UnifiedSyncService.ts..."
# Buscar el archivo de tipos de ambiente
if [ -f "backend/src/common/types/environment.types.ts" ]; then
    # Agregar LOCAL_BACKEND_URL al tipo si no existe
    if ! grep -q "LOCAL_BACKEND_URL" backend/src/common/types/environment.types.ts; then
        sed -i '/interface EnvironmentVariables/,/^}/ s/}/  LOCAL_BACKEND_URL?: string;\n}/' backend/src/common/types/environment.types.ts
    fi
else
    # Si no existe el archivo de tipos, comentar la línea problemática
    sed -i '235s/const localBackendUrl = env.LOCAL_BACKEND_URL/const localBackendUrl = process.env.LOCAL_BACKEND_URL/' backend/src/services/sync/UnifiedSyncService.ts
fi

echo "Correcciones aplicadas. Intentando compilar..."
cd backend && npm run build