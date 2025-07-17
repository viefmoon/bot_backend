import 'reflect-metadata';
import { envValidator } from './common/config/envValidator';
import logger from './common/utils/logger';
import { startMessageWorker, stopMessageWorker } from './queues/messageQueue';
import { prisma } from './lib/prisma';

async function startWorkers() {
  try {
    // Validate environment variables
    envValidator.validate();
    
    logger.info('Starting BullMQ workers...');
    
    // Initialize the message worker
    startMessageWorker();
    
    logger.info('Workers started successfully');
    
    // Graceful shutdown handlers
    const shutdown = async () => {
      logger.info('Shutting down workers...');
      
      try {
        await stopMessageWorker();
        await prisma.$disconnect();
        logger.info('Workers shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Keep the process alive
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in worker:', error);
      shutdown();
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in worker:', { reason, promise });
      shutdown();
    });
    
  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
}

// Start the workers
startWorkers();