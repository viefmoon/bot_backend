import { prisma } from '../../server';
import { Product, Category, ProductVariant } from '@prisma/client';
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
          modifierGroups: {
            include: {
              productModifiers: {
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

    // Agrupar por categoría y subcategoría
    const productsByCategory = products.reduce((acc, product) => {
      const categoryName = product.subcategory?.category?.name || 'Sin categoría';
      const subcategoryName = product.subcategory?.name || 'Sin subcategoría';
      
      if (!acc[categoryName]) acc[categoryName] = {};
      if (!acc[categoryName][subcategoryName]) {
        acc[categoryName][subcategoryName] = {
          description: product.subcategory?.description,
          products: []
        };
      }
      acc[categoryName][subcategoryName].products.push(product);
      return acc;
    }, {} as Record<string, Record<string, { description: string | null; products: any[] }>>);

    // Formatear por categoría y subcategoría
    for (const [category, subcategories] of Object.entries(productsByCategory)) {
      // Obtener información de la categoría si existe
      const categoryInfo = products.find(p => p.subcategory?.category?.name === category)?.subcategory?.category;
      
      menuText += `\n📋 **${category.toUpperCase()}**`;
      if (categoryInfo?.description) {
        menuText += ` - ${categoryInfo.description}`;
      }
      menuText += '\n\n';
      
      for (const [subcategory, data] of Object.entries(subcategories as Record<string, any>)) {
        if (subcategory !== 'Sin subcategoría') {
          menuText += `  *${subcategory}*`;
          if (data.description) {
            menuText += ` - ${data.description}`;
          }
          menuText += '\n';
        }
        
        const categoryProducts = data.products;
        
        for (const product of categoryProducts) {
          menuText += `    **${product.name}** (ID: ${product.id})`;
          
          // Agregar precio si no tiene variantes
          if (!product.hasVariants && product.price) {
            menuText += ` - $${product.price}`;
          }
          
          // Agregar descripción si existe
          if (product.description) {
            menuText += `\n      ${product.description}`;
          }
          
          menuText += '\n';
          
          // Variantes
          if (product.variants?.length > 0 && product.hasVariants) {
            for (const variant of product.variants) {
              menuText += `      - ${variant.name} (ID: ${variant.id}): $${variant.price}\n`;
            }
          }
          
          // Modificadores
          if (product.modifierGroups?.length > 0) {
            menuText += `      Modificadores:\n`;
            for (const modGroup of product.modifierGroups) {
              menuText += `        ${modGroup.name}:\n`;
              for (const mod of modGroup.productModifiers || []) {
                menuText += `          - ${mod.name}: +$${mod.price || 0}\n`;
              }
            }
          }
          
          // Ingredientes de pizza
          if (product.pizzaIngredients?.length > 0 && product.isPizza) {
            menuText += `      Ingredientes disponibles:\n`;
            for (const ingredient of product.pizzaIngredients) {
              menuText += `        - ${ingredient.name}\n`;
            }
          }
          
          menuText += "\n";
        }
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
          modifierGroups: {
            include: {
              productModifiers: true
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