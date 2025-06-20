import { EmbeddingService } from '../services/sync/EmbeddingService';
import logger from '../common/utils/logger';

/**
 * Initialize embeddings on server startup
 * Checks if embeddings need to be generated or updated
 */
export async function initializeEmbeddings(): Promise<void> {
  try {
    logger.info('🚀 Initializing product embeddings...');
    
    const updatedCount = await EmbeddingService.checkAndUpdateEmbeddings();
    
    if (updatedCount > 0) {
      logger.info(`✅ Updated embeddings for ${updatedCount} products`);
    } else {
      logger.info('✅ All product embeddings are up to date');
    }
  } catch (error) {
    logger.error('Failed to initialize embeddings:', error);
    // Don't throw - we don't want to prevent server startup if embeddings fail
    logger.warn('⚠️  Server starting without embeddings - semantic search may not work properly');
  }
}

/**
 * Schedule periodic embedding updates
 * Runs every hour to check for product changes
 */
export function scheduleEmbeddingUpdates(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  setInterval(async () => {
    try {
      logger.debug('Running scheduled embedding update check...');
      await EmbeddingService.checkAndUpdateEmbeddings();
    } catch (error) {
      logger.error('Error in scheduled embedding update:', error);
    }
  }, INTERVAL_MS);
  
  logger.info('📅 Scheduled embedding updates every hour');
}