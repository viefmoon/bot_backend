-- Script para configurar pgvector en producción (Railway PostgreSQL)
-- Ejecutar este script en la base de datos de producción

-- 1. Habilitar la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Agregar la columna embedding a la tabla Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Crear índice para búsquedas eficientes (opcional pero recomendado)
-- HNSW es el índice más eficiente para búsquedas de similitud
CREATE INDEX IF NOT EXISTS product_embedding_idx ON "Product" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. Verificar que todo está configurado correctamente
SELECT 
    COUNT(*) as total_products,
    COUNT(embedding) as products_with_embeddings
FROM "Product"
WHERE "isActive" = true;

-- Nota: Después de ejecutar este script, debes ejecutar el script de generación
-- de embeddings con la variable DATABASE_URL apuntando a producción