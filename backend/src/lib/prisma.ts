import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../common/config/envValidator';
import logger from '../common/utils/logger';

// Prisma connection pool configuration
// For production, these can be set via DATABASE_URL query parameters:
// postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=20
const prismaConfig: Prisma.PrismaClientOptions = {
  log: env.NODE_ENV === 'development' 
    ? ['error', 'warn'] 
    : ['error'],
  errorFormat: 'minimal',
};

export const prisma = new PrismaClient(prismaConfig);

// Log connection pool info on startup
prisma.$connect().then(() => {
  logger.info('Prisma connected to database', {
    environment: env.NODE_ENV,
    // Connection pool is managed internally by Prisma
    // Default pool size: num_physical_cpus * 2 + 1
    // Can be overridden with ?connection_limit=X in DATABASE_URL
  });
}).catch((error) => {
  logger.error('Failed to connect to database:', error);
  process.exit(1);
});

// Handle cleanup on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing database connections...`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));