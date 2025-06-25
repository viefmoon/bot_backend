#!/bin/bash

echo "Configurando pgvector en base de datos local..."

# Verificar si pgvector está disponible
docker compose exec -T postgres psql -U postgres -d bot_db -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ pgvector configurado exitosamente"
    exit 0
else
    echo "⚠️  No se pudo configurar pgvector (la extensión podría no estar disponible)"
    exit 1
fi