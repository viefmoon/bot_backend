import { prisma } from '../../server';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../common/config/envValidator';
import logger from '../../common/utils/logger';
import { Product, Prisma } from '@prisma/client';

interface ProductWithRelations extends Product {
  subcategory: {
    name: string;
    category: {
      name: string;
    };
  };
  variants?: Array<{ name: string; isActive: boolean }>;
  pizzaCustomizations?: Array<{ name: string; type: 'FLAVOR' | 'INGREDIENT'; isActive: boolean }>;
  modifierGroups?: Array<{
    productModifiers: Array<{ name: string; isActive: boolean }>;
    isActive: boolean;
  }>;
}

/**
 * Service for managing product embeddings
 * Handles automatic generation and updates when products change
 */
export class EmbeddingService {
  private static genAI = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
  private static embeddingModel = env.EMBEDDING_MODEL;
  private static lastSyncChecksum: string | null = null;

  /**
   * Generate embedding text for a product
   */
  private static createProductText(product: ProductWithRelations): string {
    let text = `Producto: ${product.name}. Categoría: ${product.subcategory.category.name}, ${product.subcategory.name}.`;
    
    if (product.description) {
      text += ` Descripción: ${product.description}.`;
    }
    
    if (product.isPizza && product.pizzaCustomizations && product.pizzaCustomizations.length > 0) {
      const flavors = product.pizzaCustomizations
        .filter(c => c.isActive && c.type === 'FLAVOR')
        .map(c => c.name)
        .join(', ');
      const ingredients = product.pizzaCustomizations
        .filter(c => c.isActive && c.type === 'INGREDIENT')
        .map(c => c.name)
        .join(', ');
      
      if (flavors) {
        text += ` Sabores disponibles: ${flavors}.`;
      }
      if (ingredients) {
        text += ` Ingredientes adicionales: ${ingredients}.`;
      }
    }
    
    if (product.variants && product.variants.length > 0) {
      const variantNames = product.variants
        .filter(v => v.isActive)
        .map(v => v.name)
        .join(', ');
      if (variantNames) {
        text += ` Opciones o tamaños: ${variantNames}.`;
      }
    }
    
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      const modifiers = product.modifierGroups
        .filter(g => g.isActive)
        .flatMap(g => g.productModifiers || [])
        .filter(m => m.isActive)
        .map(m => m.name)
        .join(', ');
      if (modifiers) {
        text += ` Modificadores disponibles: ${modifiers}.`;
      }
    }
    
    return text;
  }

  /**
   * Generate embedding for a single product
   */
  static async generateProductEmbedding(product: ProductWithRelations): Promise<number[]> {
    const textToEmbed = this.createProductText(product);
    
    const result = await this.genAI.models.embedContent({
      model: this.embeddingModel,
      contents: textToEmbed,
      config: {
        outputDimensionality: 768  // Force 768 dimensions for compatibility with pgvector
      }
    });
    
    const embedding = result.embeddings?.[0]?.values || [];
    
    return embedding;
  }

  /**
   * Update embedding for a single product
   */
  static async updateProductEmbedding(productId: string): Promise<void> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          subcategory: { include: { category: true } },
          variants: { where: { isActive: true } },
          pizzaCustomizations: { where: { isActive: true } },
        pizzaConfiguration: true,
          modifierGroups: {
            where: { isActive: true },
            include: {
              productModifiers: { where: { isActive: true } }
            }
          }
        }
      });

      if (!product || !product.isActive) {
        logger.warn(`Product ${productId} not found or inactive, skipping embedding generation`);
        return;
      }

      const embedding = await this.generateProductEmbedding(product as ProductWithRelations);
      
      // Update embedding in database
      await prisma.$executeRaw`
        UPDATE "Product"
        SET embedding = ${`[${embedding.join(',')}]`}::vector
        WHERE id = ${productId}
      `;
      
      logger.info(`✅ Embedding updated for product: ${product.name}`);
    } catch (error) {
      logger.error(`Error updating embedding for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Check if products have changed and need embedding updates
   */
  static async checkAndUpdateEmbeddings(): Promise<number> {
    try {
      logger.info('Checking for product changes that require embedding updates...');
      
      // Get current state checksum
      const currentChecksum = await this.calculateProductsChecksum();
      
      // Compare with last sync
      if (this.lastSyncChecksum === currentChecksum) {
        logger.info('No product changes detected, embeddings are up to date');
        return 0;
      }
      
      // Find products that need embedding updates
      const productsNeedingUpdate = await this.findProductsNeedingEmbeddings();
      
      if (productsNeedingUpdate.length === 0) {
        logger.info('All products have embeddings');
        this.lastSyncChecksum = currentChecksum;
        return 0;
      }
      
      logger.info(`Found ${productsNeedingUpdate.length} products needing embedding updates`);
      
      // Update embeddings
      let successCount = 0;
      for (const productId of productsNeedingUpdate) {
        try {
          await this.updateProductEmbedding(productId);
          successCount++;
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          logger.error(`Failed to update embedding for product ${productId}:`, error);
        }
      }
      
      // Update checksum
      this.lastSyncChecksum = currentChecksum;
      
      logger.info(`✅ Embedding update completed: ${successCount}/${productsNeedingUpdate.length} successful`);
      return successCount;
    } catch (error) {
      logger.error('Error in checkAndUpdateEmbeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate checksum of all products to detect changes
   */
  private static async calculateProductsChecksum(): Promise<string> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true
      },
      orderBy: { id: 'asc' }
    });
    
    // Create a simple checksum based on product data
    const dataString = products
      .map(p => `${p.id}:${p.name}:${p.description || ''}:${p.updatedAt.getTime()}`)
      .join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  /**
   * Find products that need embedding generation or updates
   */
  private static async findProductsNeedingEmbeddings(): Promise<string[]> {
    // Get products without embeddings
    const productsWithoutEmbeddings: { id: string }[] = await prisma.$queryRaw`
      SELECT id FROM "Product"
      WHERE "isActive" = true
      AND embedding IS NULL
    `;
    
    // Get products where updatedAt is more recent than embedding generation
    // This requires tracking embedding generation time (future enhancement)
    
    return productsWithoutEmbeddings.map(p => p.id);
  }

  /**
   * Force regenerate all embeddings (useful for algorithm updates)
   */
  static async regenerateAllEmbeddings(): Promise<void> {
    logger.info('Starting full embedding regeneration...');
    
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        subcategory: { include: { category: true } },
        variants: { where: { isActive: true } },
        pizzaCustomizations: { where: { isActive: true } },
        pizzaConfiguration: true,
        modifierGroups: {
          where: { isActive: true },
          include: {
            productModifiers: { where: { isActive: true } }
          }
        }
      }
    });
    
    logger.info(`Found ${products.length} products to process`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        const embedding = await this.generateProductEmbedding(product as ProductWithRelations);
        
        await prisma.$executeRaw`
          UPDATE "Product"
          SET embedding = ${`[${embedding.join(',')}]`}::vector
          WHERE id = ${product.id}
        `;
        
        successCount++;
        logger.info(`✅ Embedding saved for: ${product.name} (${successCount}/${products.length})`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error with ${product.name}:`, error);
      }
    }
    
    logger.info(`
✅ Regeneration completed:
   - Products processed: ${successCount}
   - Errors: ${errorCount}
   - Total: ${products.length}
    `);
  }
}