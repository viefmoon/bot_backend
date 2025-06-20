import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Establecer NODE_ENV si no está definido
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Importar EmbeddingService después de configurar el entorno
import { EmbeddingService } from '../src/services/sync/EmbeddingService';
import { prisma } from '../src/server';

async function main() {
  console.log('Iniciando la generación de embeddings para todos los productos...');

  try {
    await EmbeddingService.regenerateAllEmbeddings();
  } catch (error) {
    console.error('Error fatal en el script:', error);
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('Error no manejado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });