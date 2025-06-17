import { prisma } from '../../server';
import { Product, Category, Subcategory, ProductVariant, ModifierType } from '@prisma/client';
import logger from '../../common/utils/logger';
import { NotFoundError, ErrorCode } from '../../common/services/errors';

/**
 * Service for managing products and categories
 */
export class ProductService {
  /**
   * Get all active products with their relations
   */
  static async getActiveProducts(): Promise<Product[]> {
    try {
      return await prisma.product.findMany({
        where: { isActive: true },
        include: {
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
        }
      });
    } catch (error) {
      logger.error('Error fetching active products:', error);
      throw error;
    }
  }

  /**
   * Get all active categories with their relations
   */
  static async getActiveCategories(): Promise<Category[]> {
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        include: {
          subcategories: {
            where: { isActive: true },
            include: {
              products: {
                where: { isActive: true }
              }
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching active categories:', error);
      throw error;
    }
  }

  /**
   * Check if a product is active
   */
  static async isProductActive(productId: string): Promise<boolean> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { isActive: true }
      });
      return product?.isActive ?? false;
    } catch (error) {
      logger.error('Error checking product status:', error);
      throw error;
    }
  }

  /**
   * Toggle product active status
   */
  static async toggleProductStatus(productId: string, isActive: boolean): Promise<Product> {
    try {
      const product = await prisma.product.update({
        where: { id: productId },
        data: { isActive }
      });
      
      logger.info(`Product ${productId} status updated to ${isActive ? 'active' : 'inactive'}`);
      return product;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError(
          ErrorCode.INVALID_PRODUCT,
          'Product not found',
          { metadata: { productId } }
        );
      }
      
      logger.error('Error toggling product status:', error);
      throw error;
    }
  }

  /**
   * Get product by ID with all relations
   */
  static async getProductById(productId: string): Promise<Product | null> {
    try {
      return await prisma.product.findUnique({
        where: { id: productId },
        include: {
          subcategory: {
            include: {
              category: true
            }
          },
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
   * Get products by subcategory
   */
  static async getProductsBySubcategory(subcategoryId: string): Promise<Product[]> {
    try {
      return await prisma.product.findMany({
        where: { 
          subcategoryId,
          isActive: true 
        },
        include: {
          variants: {
            where: { isActive: true }
          },
          modifierTypes: {
            include: {
              modifiers: {
                where: { isActive: true }
              }
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching products by subcategory:', error);
      throw error;
    }
  }
}