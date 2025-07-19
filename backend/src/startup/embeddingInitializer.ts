import { EmbeddingManager } from '../services/sync/EmbeddingManager';
import logger from '../common/utils/logger';

/**
 * Initialize embeddings on server startup
 * Uses EmbeddingManager for intelligent embedding lifecycle management
 */
export async function initializeEmbeddings(): Promise<void> {
  try {
    logger.info('🚀 Initializing embedding manager...');
    await EmbeddingManager.initialize();
  } catch (error) {
    logger.error('Failed to initialize embedding manager:', error);
    // Don't throw - we don't want to prevent server startup if embeddings fail
    logger.warn('⚠️  Server starting without embedding manager - semantic search may not work properly');
  }
}
