-- CreateExtension (solo si está disponible)
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable (comentado temporalmente - aplicar manualmente en producción)
-- ALTER TABLE "Product" ADD COLUMN     "embedding" vector(768);

-- Para desarrollo local sin pgvector, usar una columna JSON temporal
ALTER TABLE "Product" ADD COLUMN     "embedding" JSONB;
