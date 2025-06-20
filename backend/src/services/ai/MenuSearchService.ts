import logger from '../../common/utils/logger';
import { ProductService } from '../products/ProductService';

/**
 * Service for searching and matching menu items based on natural language input
 */
export class MenuSearchService {
  /**
   * Gets relevant menu items based on keywords using string similarity
   * @param itemsSummary Natural language description of items
   * @returns JSON string of relevant menu items with their full structure
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    try {
      const stringSimilarity = await import('string-similarity');
      
      logger.debug(`Getting relevant menu for: "${itemsSummary}"`);
      
      // Get products with all their relations
      const products = await ProductService.getActiveProducts({ includeRelations: true }) as any[];
      
      // Normalize text for better matching
      const normalizedSummary = this.normalizeText(itemsSummary);
      
      logger.debug(`Normalized search: "${normalizedSummary}"`);
      
      // Score each product based on similarity
      const scoredProducts = products.map(product => {
        const productName = this.normalizeText(product.name || '');
        const productDesc = this.normalizeText(product.description || '');
        const categoryName = this.normalizeText(product.subcategory?.category?.name || '');
        const subcategoryName = this.normalizeText(product.subcategory?.name || '');
        
        // Create search target combinations
        const searchTargets = [
          productName, // Highest priority
          `${productName} ${categoryName}`,
          `${productName} ${subcategoryName}`,
          `${productName} ${productDesc}`,
        ];
        
        // Calculate similarity scores for each target
        const similarities = searchTargets.map(target => 
          stringSimilarity.compareTwoStrings(normalizedSummary, target)
        );
        
        // Get best match score
        const bestScore = Math.max(...similarities);
        
        // Calculate bonus score for partial word matches
        const bonusScore = this.calculateBonusScore(normalizedSummary, productName, stringSimilarity);
        
        const finalScore = bestScore + bonusScore;
        
        return { 
          product, 
          score: finalScore,
          debug: {
            productName,
            bestScore,
            bonusScore,
            finalScore
          }
        };
      });
      
      // Filter and sort by score
      let relevantProducts = scoredProducts
        .filter(item => item.score > 0.3) // 30% similarity threshold
        .sort((a, b) => b.score - a.score);
      
      // Log top matches for debugging
      logger.debug(`Top matches:`);
      relevantProducts.slice(0, 5).forEach((item, index) => {
        logger.debug(`${index + 1}. ${item.debug.productName} (score: ${item.score.toFixed(3)})`);
      });
      
      // If no good matches, try more lenient threshold
      if (relevantProducts.length === 0) {
        logger.debug('No products found with 30% threshold, trying 20%...');
        const lenientMatches = scoredProducts
          .filter(item => item.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
          
        if (lenientMatches.length > 0) {
          relevantProducts = lenientMatches;
        }
      }
      
      // Build complete menu structure with all relations
      const menuStructure = this.buildMenuStructure(relevantProducts.slice(0, 15));
      
      // Log the menu structure
      logger.debug(`Returning ${menuStructure.length} relevant products`);
      if (menuStructure.length > 0) {
        (logger as any).json('Relevant menu structure:', menuStructure);
      }
      
      return JSON.stringify(menuStructure);
    } catch (error) {
      logger.error('Error getting relevant menu:', error);
      return "[]";
    }
  }

  /**
   * Normalizes text for better search matching
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Replace non-word chars with space
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .trim();
  }

  /**
   * Calculates bonus score for partial word matches
   */
  private static calculateBonusScore(
    normalizedSummary: string, 
    productName: string, 
    stringSimilarity: any
  ): number {
    let bonusScore = 0;
    
    // Check if any word from summary appears in product name
    const summaryWords = normalizedSummary.split(' ').filter(w => w.length > 2);
    const productWords = productName.split(' ');
    
    summaryWords.forEach(summaryWord => {
      productWords.forEach(productWord => {
        const wordSimilarity = stringSimilarity.compareTwoStrings(summaryWord, productWord);
        if (wordSimilarity > 0.8) { // 80% similarity threshold for individual words
          bonusScore += 0.2;
        }
      });
    });
    
    return bonusScore;
  }

  /**
   * Builds the menu structure for AI consumption
   */
  private static buildMenuStructure(scoredProducts: any[]): any[] {
    return scoredProducts
      .map(item => item.product)
      .map(product => {
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
              requerido: group.required,
              multiple: group.acceptsMultiple,
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