import { prisma } from '../../lib/prisma';
import { EmbeddingService } from './EmbeddingService';
import logger from '../../common/utils/logger';
import { env } from '../../common/config/envValidator';

/**
 * Manages embedding lifecycle and automatic generation
 * Coordinates with sync service to generate embeddings after menu updates
 */
export class EmbeddingManager {
  private static isGenerating = false;
  private static lastGenerationTime: Date | null = null;
  private static generationAttempts = 0;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
  private static scheduledCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Check if embeddings can be generated (products exist)
   */
  static async canGenerateEmbeddings(): Promise<boolean> {
    const productCount = await prisma.product.count({
      where: { isActive: true }
    });
    return productCount > 0;
  }

  /**
   * Get embedding generation status
   */
  static async getEmbeddingStatus(): Promise<{
    hasProducts: boolean;
    totalProducts: number;
    productsWithEmbeddings: number;
    productsNeedingEmbeddings: number;
    lastGenerationTime: Date | null;
    isGenerating: boolean;
  }> {
    const totalProducts = await prisma.product.count({
      where: { isActive: true }
    });

    // Count products with embeddings using raw query
    const productsWithEmbeddings: { count: bigint }[] = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "Product" 
      WHERE "isActive" = true 
      AND embedding IS NOT NULL
    `;
    const withEmbeddingsCount = Number(productsWithEmbeddings[0]?.count || 0);

    return {
      hasProducts: totalProducts > 0,
      totalProducts,
      productsWithEmbeddings: withEmbeddingsCount,
      productsNeedingEmbeddings: totalProducts - withEmbeddingsCount,
      lastGenerationTime: this.lastGenerationTime,
      isGenerating: this.isGenerating
    };
  }

  /**
   * Trigger embedding generation after sync
   * Called automatically after menu sync completes
   */
  static async generateEmbeddingsAfterSync(): Promise<number> {
    try {
      // Check if API key is configured
      if (!env.GOOGLE_AI_API_KEY) {
        logger.warn('⚠️  Google AI API key not configured, skipping embedding generation');
        return 0;
      }

      // Prevent concurrent generation
      if (this.isGenerating) {
        logger.info('Embedding generation already in progress, skipping');
        return 0;
      }

      // Check if we can generate embeddings
      const canGenerate = await this.canGenerateEmbeddings();
      if (!canGenerate) {
        logger.info('No products available for embedding generation');
        return 0;
      }

      // Check status
      const status = await this.getEmbeddingStatus();
      if (status.productsNeedingEmbeddings === 0) {
        logger.info('All products already have embeddings');
        return 0;
      }

      logger.info(`🚀 Starting embedding generation for ${status.productsNeedingEmbeddings} products`);
      this.isGenerating = true;

      // Generate embeddings
      const updatedCount = await EmbeddingService.checkAndUpdateEmbeddings();
      
      this.lastGenerationTime = new Date();
      this.generationAttempts = 0; // Reset attempts on success
      
      logger.info(`✅ Embedding generation completed: ${updatedCount} products updated`);
      return updatedCount;
    } catch (error) {
      logger.error('Error generating embeddings after sync:', error);
      this.generationAttempts++;
      
      // Schedule retry if under max attempts
      if (this.generationAttempts < this.MAX_ATTEMPTS) {
        logger.info(`Scheduling embedding generation retry (attempt ${this.generationAttempts + 1}/${this.MAX_ATTEMPTS}) in 5 minutes`);
        setTimeout(() => this.generateEmbeddingsAfterSync(), this.RETRY_DELAY_MS);
      }
      return 0; // Return 0 on error
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Initialize embedding management
   * Sets up periodic checks and initial generation
   */
  static async initialize(): Promise<void> {
    try {
      // Check if API key is configured
      if (!env.GOOGLE_AI_API_KEY) {
        logger.warn('⚠️  Google AI API key not configured, embedding features disabled');
        return;
      }

      const status = await this.getEmbeddingStatus();
      
      if (!status.hasProducts) {
        logger.info('📦 No products in database yet, embeddings will be generated after first sync');
        // Schedule periodic checks for when products arrive
        this.schedulePeriodicChecks();
        return;
      }

      if (status.productsNeedingEmbeddings > 0) {
        logger.info(`Found ${status.productsNeedingEmbeddings} products without embeddings`);
        // Don't block startup, generate in background
        setTimeout(() => this.generateEmbeddingsAfterSync(), 5000);
      } else {
        logger.info('✅ All products have embeddings');
      }

      // Schedule periodic checks
      this.schedulePeriodicChecks();
    } catch (error) {
      logger.error('Error initializing embedding manager:', error);
    }
  }

  /**
   * Schedule periodic embedding checks
   * Runs every hour to catch any missed updates
   */
  private static schedulePeriodicChecks(): void {
    // Clear any existing interval
    if (this.scheduledCheckInterval) {
      clearInterval(this.scheduledCheckInterval);
    }

    // Check every hour
    const INTERVAL_MS = 60 * 60 * 1000;
    
    this.scheduledCheckInterval = setInterval(async () => {
      try {
        const status = await this.getEmbeddingStatus();
        
        if (status.hasProducts && status.productsNeedingEmbeddings > 0) {
          logger.info(`Periodic check found ${status.productsNeedingEmbeddings} products needing embeddings`);
          await this.generateEmbeddingsAfterSync();
        }
      } catch (error) {
        logger.error('Error in periodic embedding check:', error);
      }
    }, INTERVAL_MS);
    
    logger.info('📅 Scheduled periodic embedding checks every hour');
  }

  /**
   * Force regenerate all embeddings
   * Useful for debugging or after major changes
   */
  static async forceRegenerateAll(): Promise<number> {
    try {
      logger.info('🔄 Force regenerating all embeddings...');
      
      // Clear all existing embeddings using raw query
      await prisma.$executeRaw`
        UPDATE "Product" 
        SET embedding = NULL 
        WHERE "isActive" = true
      `;
      
      // Generate new embeddings
      return await EmbeddingService.checkAndUpdateEmbeddings();
    } catch (error) {
      logger.error('Error force regenerating embeddings:', error);
      throw error;
    }
  }
}