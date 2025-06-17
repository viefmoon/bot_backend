import { prisma } from '../../server';
import { Product, Category, Subcategory, ProductVariant, ModifierType } from '@prisma/client';
import logger from '../../common/utils/logger';
import { NotFoundError, ErrorCode } from '../../common/services/errors';

/**
 * Service for managing products and menu
 */
export class ProductService {
  /**
   * Get all active products with their relations
   */
  static async getActiveProducts(options?: {
    includeRelations?: boolean;
    formatForAI?: boolean;
  }): Promise<Product[] | string> {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: options?.includeRelations !== false ? {
          subcategory: {
            include: {
              category: true
            }
          },
          variants: {
            where: { isActive: true }
          },
          modifierTypes: {
            include: {
              modifiers: {
                where: { isActive: true }
              }
            }
          },
          pizzaIngredients: {
            where: { isActive: true }
          }
        } : undefined
      });

      // Si se solicita formato para AI, formatear el menú
      if (options?.formatForAI) {
        return this.formatMenuForAI(products);
      }

      return products;
    } catch (error) {
      logger.error('Error fetching active products:', error);
      throw error;
    }
  }

  /**
   * Format menu for AI consumption
   */
  private static formatMenuForAI(products: any[]): string {
    let menuText = "=== MENÚ COMPLETO ===\n\n";

    // Agrupar por categoría
    const productsByCategory = products.reduce((acc, product) => {
      const categoryName = product.subcategory?.category?.name || 'Sin categoría';
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push(product);
      return acc;
    }, {} as Record<string, any[]>);

    // Formatear por categoría
    for (const [category, categoryProducts] of Object.entries(productsByCategory) as [string, any[]][]) {
      menuText += `\n📋 **${category.toUpperCase()}**\n\n`;
      
      for (const product of categoryProducts) {
        menuText += `**${product.name}** (ID: ${product.id})\n`;
        
        // Variantes
        if (product.variants?.length > 0) {
          for (const variant of product.variants) {
            menuText += `  - ${variant.name} (ID: ${variant.id}): $${variant.price}\n`;
          }
        }
        
        // Modificadores
        if (product.modifierTypes?.length > 0) {
          menuText += `  Modificadores:\n`;
          for (const modType of product.modifierTypes) {
            menuText += `    ${modType.name}:\n`;
            for (const mod of modType.modifiers || []) {
              menuText += `      - ${mod.name}: +$${mod.price}\n`;
            }
          }
        }
        
        // Ingredientes de pizza
        if (product.pizzaIngredients?.length > 0) {
          menuText += `  Ingredientes disponibles:\n`;
          for (const ingredient of product.pizzaIngredients) {
            menuText += `    - ${ingredient.name}\n`;
          }
        }
        
        menuText += "\n";
      }
    }

    return menuText;
  }

  /**
   * Get all active categories
   */
  static async getActiveCategories(): Promise<Category[]> {
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        include: {
          subcategories: {
            where: { isActive: true }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching active categories:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  static async getProductById(productId: string): Promise<Product | null> {
    try {
      return await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          modifierTypes: {
            include: {
              modifiers: true
            }
          },
          pizzaIngredients: true
        }
      });
    } catch (error) {
      logger.error('Error fetching product by ID:', error);
      throw error;
    }
  }

  /**
   * Get variant by ID
   */
  static async getVariantById(variantId: string): Promise<ProductVariant | null> {
    try {
      return await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: true
        }
      });
    } catch (error) {
      logger.error('Error fetching variant by ID:', error);
      throw error;
    }
  }

  /**
   * Toggle product availability
   */
  static async toggleProductAvailability(productId: string, isActive: boolean): Promise<Product> {
    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data: { isActive }
      });

      logger.info(`Product ${productId} availability set to ${isActive}`);
      return product;
    } catch (error) {
      logger.error('Error toggling product availability:', error);
      throw new NotFoundError(
        ErrorCode.INVALID_PRODUCT,
        'Product not found',
        { metadata: { productId } }
      );
    }
  }

  /**
   * Toggle variant availability
   */
  static async toggleVariantAvailability(variantId: string, isActive: boolean): Promise<ProductVariant> {
    try {
      const variant = await prisma.productVariant.update({
        where: { id: variantId },
        data: { isActive }
      });

      logger.info(`Variant ${variantId} availability set to ${isActive}`);
      return variant;
    } catch (error) {
      logger.error('Error toggling variant availability:', error);
      throw new NotFoundError(
        ErrorCode.INVALID_PRODUCT,
        'Product variant not found',
        { metadata: { variantId } }
      );
    }
  }
}