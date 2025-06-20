import logger from '../../common/utils/logger';
import { prisma } from '../../server';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../common/config/envValidator';

/**
 * Service for searching and matching menu items based on natural language input
 * Uses semantic search with Google embeddings and pgvector
 */
export class MenuSearchService {
  private static genAI = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });

  /**
   * Gets relevant menu items based on keywords using semantic search
   * @param itemsSummary Natural language description of items
   * @returns JSON string of relevant menu items with their full structure
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    try {
      logger.debug(`Getting relevant menu for: "${itemsSummary}"`);

      // 1. Generate embedding for user query
      logger.debug('Generating embedding for user query...');
      const embeddingResponse = await this.genAI.models.embedContent({
        model: "text-embedding-004",
        contents: itemsSummary
      });
      const queryEmbedding = embeddingResponse.embeddings?.[0]?.values || [];
      logger.debug(`Query embedding generated with ${queryEmbedding.length} dimensions`);

      // 2. Search database for most similar products
      // For local dev with JSONB, we need a different query
      const isDevelopment = !env.DATABASE_URL?.includes('railway');
      let relevantProductIds: string[] = [];

      if (isDevelopment) {
        // Development: Get all products with embeddings and calculate similarity in JS
        logger.debug('Using development mode (JSONB embeddings)');
        const productsWithEmbeddings: { id: string; embedding: any }[] = await prisma.$queryRaw`
          SELECT id, embedding
          FROM "Product"
          WHERE embedding IS NOT NULL
          AND "isActive" = true
        `;

        // Calculate cosine similarity for each product
        const productScores = productsWithEmbeddings.map(product => {
          const productEmbedding = product.embedding as number[];
          const similarity = this.cosineSimilarity(queryEmbedding, productEmbedding);
          return { id: product.id, similarity };
        });

        // Sort by similarity and take top 15
        productScores.sort((a, b) => b.similarity - a.similarity);
        relevantProductIds = productScores.slice(0, 15).map(p => p.id);
        
        logger.debug(`Top 5 matches:`, productScores.slice(0, 5).map(p => 
          `${p.id} (similarity: ${p.similarity.toFixed(3)})`
        ));
      } else {
        // Production: Use pgvector for efficient search
        logger.debug('Using production mode (pgvector)');
        const relevantProductsResult: { id: string }[] = await prisma.$queryRaw`
          SELECT id FROM "Product"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector
          LIMIT 15
        `;
        relevantProductIds = relevantProductsResult.map(p => p.id);
      }

      if (relevantProductIds.length === 0) {
        logger.warn('No relevant products found via vector search');
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
          pizzaIngredients: { where: { isActive: true } },
        },
      });

      // 4. Sort products by the original order from search
      const sortedProducts = relevantProductIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean);

      // 5. Build menu structure
      const menuStructure = this.buildMenuStructure(sortedProducts as any[]);
      
      logger.debug(`Returning ${menuStructure.length} relevant products from vector search`);
      if (menuStructure.length > 0) {
        (logger as any).json('Relevant menu structure:', menuStructure);
      }
      
      return JSON.stringify(menuStructure);
    } catch (error) {
      logger.error('Error in vector search:', error);
      return "[]";
    }
  }

  /**
   * Calculates cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Builds the menu structure for AI consumption
   */
  private static buildMenuStructure(products: any[]): any[] {
    return products.map(product => {
      const item: any = {
        id: product.id,
        nombre: product.name,
      };
      
      // Include variants with complete information
      if (product.variants?.length > 0) {
        item.variantes = product.variants.map((v: any) => ({
          id: v.id,
          nombre: v.name,
          precio: v.price
        }));
      }
      
      // Include modifiers if they exist
      if (product.modifierGroups?.length > 0) {
        item.modificadores = product.modifierGroups
          .filter((g: any) => g.productModifiers?.length > 0)
          .map((group: any) => ({
            grupo: group.name,
            requerido: group.isRequired,
            multiple: group.allowMultipleSelections,
            opciones: group.productModifiers.map((m: any) => ({
              id: m.id,
              nombre: m.name,
              precio: m.price
            }))
          }));
      }
      
      // Include pizza ingredients if it's a pizza
      if (product.isPizza && product.pizzaIngredients?.length > 0) {
        item.ingredientesPizza = product.pizzaIngredients.map((i: any) => ({
          id: i.id,
          nombre: i.name
        }));
      }
      
      return item;
    });
  }
}