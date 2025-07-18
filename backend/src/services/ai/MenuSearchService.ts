import logger from '../../common/utils/logger';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../common/config/envValidator';
import { TechnicalError, ErrorCode } from '../../common/services/errors';

/**
 * Service for searching and matching menu items based on natural language input
 * Uses semantic search with Google embeddings and pgvector
 */
export class MenuSearchService {
  private static genAI = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
  
  // Constants for vector search optimization
  // Based on testing: 0.0-0.3 = very similar, 0.3-0.4 = somewhat similar, >0.4 = different
  private static readonly SIMILARITY_THRESHOLD = 0.48; // Slightly more flexible, balanced approach
  private static readonly RESULTS_LIMIT = 12; // Good amount of relevant results
  private static readonly FALLBACK_THRESHOLD = 0.52; // More flexible for edge cases

  /**
   * Gets relevant menu items based on keywords using semantic search
   * @param itemsSummary Natural language description of items
   * @returns JSON string of relevant menu items with their full structure
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    try {
      // 1. Generate embedding for user query
      const embeddingResponse = await this.genAI.models.embedContent({
        model: env.EMBEDDING_MODEL,
        contents: itemsSummary,
        config: {
          outputDimensionality: 768  // Force 768 dimensions for compatibility with pgvector
        }
      });
      const queryEmbedding = embeddingResponse.embeddings?.[0]?.values || [];
      
      if (queryEmbedding.length === 0) {
        logger.error('Failed to generate embedding for query');
        throw new TechnicalError(
          ErrorCode.EMBEDDING_GENERATION_FAILED,
          'Failed to generate embedding for menu search query',
          { query: itemsSummary }
        );
      }

      // 2. Search database for most similar products using pgvector
      let relevantProductIds: string[] = [];

      // Use pgvector for efficient similarity search with threshold
      try {
        // Use optimized query that filters by similarity threshold directly in SQL
        // This leverages the HNSW index more efficiently
        const embeddingVector = `[${queryEmbedding.join(',')}]`;
        const relevantProductsResult: { id: string, distance: number }[] = await prisma.$queryRaw`
          SELECT id, 
                 (embedding <=> ${Prisma.sql`${embeddingVector}::vector`}) as distance
          FROM "Product"
          WHERE embedding IS NOT NULL
            AND (embedding <=> ${Prisma.sql`${embeddingVector}::vector`}) < ${this.SIMILARITY_THRESHOLD}
          ORDER BY distance
          LIMIT ${this.RESULTS_LIMIT}
        `;
        
        // If no results found, try again with fallback threshold
        if (relevantProductsResult.length === 0) {
          const fallbackResult: { id: string, distance: number }[] = await prisma.$queryRaw`
            SELECT id, 
                   (embedding <=> ${Prisma.sql`${embeddingVector}::vector`}) as distance
            FROM "Product"
            WHERE embedding IS NOT NULL
              AND (embedding <=> ${Prisma.sql`${embeddingVector}::vector`}) < ${this.FALLBACK_THRESHOLD}
            ORDER BY distance
            LIMIT 1
          `;
          
          if (fallbackResult.length > 0) {
            relevantProductsResult.push(fallbackResult[0]);
          }
        }
        
        relevantProductIds = relevantProductsResult.map(p => p.id);
      } catch (error) {
        logger.error('Error in vector search:', error);
        return "[]";
      }

      if (relevantProductIds.length === 0) {
        logger.warn('No relevant products found via vector search within threshold');
        return "[]";
      }

      // 3. Get full product details
      const products = await prisma.product.findMany({
        where: {
          id: { in: relevantProductIds },
          isActive: true,
        },
        include: {
          subcategory: { include: { category: true } },
          variants: { where: { isActive: true } },
          modifierGroups: {
            where: { isActive: true },
            include: {
              productModifiers: { where: { isActive: true } },
            },
          },
          pizzaCustomizations: { where: { isActive: true } },
        },
      });

      // 4. Sort products by the original order from search
      const sortedProducts = relevantProductIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean);

      // 5. Build menu structure
      const menuStructure = this.buildMenuStructure(sortedProducts as any[]);
      
      logger.info(`MenuSearchService: Returning ${menuStructure.length} relevant products for query "${itemsSummary}"`);
      // Log only product names for debugging, not full structure
      if (menuStructure.length > 0) {
        const productNames = menuStructure.map((p: any) => p.nombre).join(', ');
        logger.info(`MenuSearchService: Products found: ${productNames}`);
      } else {
        logger.warn(`MenuSearchService: No relevant products found for query "${itemsSummary}"`);
      }
      
      return JSON.stringify(menuStructure);
    } catch (error) {
      logger.error('Error in vector search:', error);
      return "[]";
    }
  }


  /**
   * Builds the menu structure for AI consumption
   * Only includes necessary information for order mapping (no prices needed at this stage)
   */
  private static buildMenuStructure(products: any[]): any[] {
    return products.map(product => {
      const item: any = {
        id: product.id,
        nombre: product.name,
      };
      
      // Include variants with IDs and names only (no prices)
      if (product.variants?.length > 0) {
        item.variantes = product.variants.map((v: any) => ({
          id: v.id,
          nombre: v.name
        }));
      }
      
      // Include modifiers if they exist (simplified)
      if (product.modifierGroups?.length > 0) {
        item.modificadores = product.modifierGroups
          .filter((g: any) => g.productModifiers?.length > 0)
          .map((group: any) => ({
            grupo: group.name,
            opciones: group.productModifiers.map((m: any) => ({
              id: m.id,
              nombre: m.name
            }))
          }));
      }
      
      // Include pizza customizations if it's a pizza
      if (product.isPizza && product.pizzaCustomizations?.length > 0) {
        item.personalizacionesPizza = product.pizzaCustomizations.map((c: any) => ({
          id: c.id,
          nombre: c.name,
          tipo: c.type
        }));
      }
      
      return item;
    });
  }
}