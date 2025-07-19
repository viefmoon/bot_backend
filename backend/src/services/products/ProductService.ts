import { prisma } from '../../lib/prisma';
import { Product, Category, ProductVariant } from '@prisma/client';
import logger from '../../common/utils/logger';
import { NotFoundError, ErrorCode } from '../../common/services/errors';
import { RedisService } from '../redis/RedisService';

/**
 * Service for managing products and menu
 */
export class ProductService {
  // Cache configuration
  private static readonly MENU_CACHE_KEY = 'menu:whatsapp:full_text';
  private static readonly MENU_CACHE_TTL = 3600; // 1 hour in seconds
  /**
   * Get all active products with their relations
   */
  static async getActiveProducts(includeRelations = true): Promise<Product[]> {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: includeRelations ? {
          subcategory: {
            include: {
              category: true
            }
          },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              productModifiers: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' }
              }
            }
          },
          pizzaCustomizations: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          pizzaConfiguration: true
        } : undefined
      });

      return products;
    } catch (error) {
      logger.error('Error fetching active products:', error);
      throw error;
    }
  }
  
  /**
   * Get active products optimized for WhatsApp menu display
   * Only selects fields needed for formatting, significantly reducing data transfer
   */
  static async getActiveProductsForWhatsApp(): Promise<any[]> {
    try {
      return await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
          price: true,
          hasVariants: true,
          isPizza: true,
          subcategory: {
            select: {
              category: {
                select: { 
                  name: true, 
                  sortOrder: true 
                }
              }
            }
          },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: { 
              name: true, 
              price: true 
            }
          },
          modifierGroups: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              name: true,
              productModifiers: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                select: { 
                  name: true, 
                  price: true 
                }
              }
            }
          },
          pizzaCustomizations: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: { 
              name: true, 
              type: true, 
              ingredients: true, 
              toppingValue: true 
            }
          },
          pizzaConfiguration: {
            select: { 
              includedToppings: true, 
              extraToppingCost: true 
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching optimized products for WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Get formatted menu for WhatsApp with aggressive caching
   */
  static async getMenuForWhatsApp(): Promise<string> {
    try {
      // Try to get cached menu first
      const redisService = RedisService.getInstance();
      const cachedMenu = await redisService.get(this.MENU_CACHE_KEY);
      
      if (cachedMenu) {
        logger.debug('Returning cached WhatsApp menu');
        return cachedMenu;
      }
      
      // Cache miss - generate menu
      logger.info('Cache miss - generating WhatsApp menu');
      const products = await this.getActiveProductsForWhatsApp();
      
      // Get restaurant name
      let restaurantName = "Nuestro Restaurante";
      try {
        const { RestaurantService } = await import('../restaurant/RestaurantService');
        const config = await RestaurantService.getConfig();
        restaurantName = config.restaurantName;
      } catch (error) {
        // Use default name
      }
      
      const menuText = this.formatMenuForWhatsApp(products, restaurantName);
      
      // Cache the generated menu
      await redisService.set(this.MENU_CACHE_KEY, menuText, this.MENU_CACHE_TTL);
      logger.info('WhatsApp menu cached successfully');
      
      return menuText;
    } catch (error) {
      logger.error('Error getting menu for WhatsApp:', error);
      throw error;
    }
  }
  
  /**
   * Invalidate the WhatsApp menu cache
   * Call this when menu data changes
   */
  static async invalidateMenuCache(): Promise<void> {
    try {
      const redisService = RedisService.getInstance();
      await redisService.del(this.MENU_CACHE_KEY);
      logger.info('WhatsApp menu cache invalidated');
    } catch (error) {
      logger.error('Error invalidating menu cache:', error);
    }
  }

  /**
   * Format menu for WhatsApp - Improved formatting with better readability
   */
  private static formatMenuForWhatsApp(products: any[], restaurantName: string = "Nuestro Restaurante"): string {
    const menuLines: string[] = [];

    // Header
    menuLines.push(`*🍽️ MENÚ ${restaurantName.toUpperCase()} 🍽️*`);
    menuLines.push("━━━━━━━━━━━━━━━━━━━━━━");

    // Agrupar por categoría con sortOrder
    const productsByCategory = products.reduce((acc, product) => {
      const category = product.subcategory?.category;
      const categoryName = category?.name || 'Sin categoría';
      const categorySortOrder = category?.sortOrder || 999;
      
      if (!acc[categoryName]) {
        acc[categoryName] = {
          sortOrder: categorySortOrder,
          products: []
        };
      }
      acc[categoryName].products.push(product);
      return acc;
    }, {} as Record<string, { sortOrder: number; products: any[] }>);

    // Ordenar categorías por sortOrder
    const sortedCategories = Object.entries(productsByCategory)
      .sort(([, a], [, b]) => (a as any).sortOrder - (b as any).sortOrder);

    // Formatear por categoría
    for (const [category, data] of sortedCategories) {
      menuLines.push(`\n*◆ ${category.toUpperCase()} ◆*`);
      
      // Productos ya vienen ordenados por sortOrder desde la consulta
      (data as any).products.forEach((product: any, index: number) => {
        // Agregar separación entre productos (excepto el primero)
        if (index > 0) {
          menuLines.push('─────────');
        }
        
        // Nombre del producto con precio si no tiene variantes
        let productLine = `*${product.name}*`;
        if (!product.hasVariants && product.price) {
          productLine += ` → \`$${product.price.toFixed(2)}\``;
        }
        menuLines.push(productLine);
        
        // Variantes con precios (ya ordenadas)
        if (product.variants?.length > 0 && product.hasVariants) {
          product.variants.forEach((variant: any) => {
            menuLines.push(` _${variant.name}_: \`$${variant.price.toFixed(2)}\``);
          });
        }
        
        // Para pizzas, mostrar sabores disponibles
        if (product.isPizza && product.pizzaCustomizations?.length > 0) {
          const flavors = product.pizzaCustomizations.filter((c: any) => c.type === 'FLAVOR');
          if (flavors.length > 0) {
            menuLines.push(` _◇ Sabores:_`);
            
            // Obtener configuración de pizza
            const pizzaConfig = product.pizzaConfiguration;
            const includedToppings = pizzaConfig?.includedToppings || 4;
            const extraToppingCost = pizzaConfig?.extraToppingCost || 20;
            
            flavors.forEach((flavor: any) => {
              let flavorLine = `  • ${flavor.name}`;
              
              // Agregar ingredientes si existen
              if (flavor.ingredients) {
                flavorLine += ` _(${flavor.ingredients})_`;
              }
              
              // Calcular precio extra si el sabor excede los toppings incluidos
              if (flavor.toppingValue > includedToppings) {
                const extraToppings = flavor.toppingValue - includedToppings;
                const extraCost = extraToppings * extraToppingCost;
                flavorLine += ` \`+$${extraCost.toFixed(2)}\``;
              }
              
              menuLines.push(flavorLine);
            });
            
            menuLines.push(` _◇ Máx. 2 mitades_`);
          }
        }
        
        // Mostrar todos los modificadores agrupados
        if (product.modifierGroups?.length > 0) {
          product.modifierGroups.forEach((group: any) => {
            const activeModifiers = group.productModifiers?.filter((m: any) => m.isActive) || [];
            if (activeModifiers.length > 0) {
              menuLines.push(` _◇ ${group.name}:_`);
              
              activeModifiers.forEach((modifier: any) => {
                // Solo agregar precio si es mayor a 0
                if (modifier.price && modifier.price > 0) {
                  menuLines.push(`  • ${modifier.name} \`+$${modifier.price.toFixed(2)}\``);
                } else {
                  menuLines.push(`  • ${modifier.name}`);
                }
              });
            }
          });
        }
      });
    }

    // Footer
    menuLines.push("\n━━━━━━━━━━━━━━━━━━━━━━");
    menuLines.push("_📱 Para ordenar: menciona el producto completo con variante, extras y comentarios_");

    return menuLines.join('\n');
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
          pizzaCustomizations: true,
          pizzaConfiguration: true
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

  /**
   * Get menu structure for AI context (without IDs or prices)
   */
  static async getMenuStructureForAI(): Promise<any> {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: {
          subcategory: {
            include: {
              category: true
            }
          },
          variants: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              productModifiers: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' }
              }
            }
          },
          pizzaCustomizations: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          pizzaConfiguration: true
        },
        orderBy: { sortOrder: 'asc' }
      });

      // Agrupar por categorías
      const menuStructure: Record<string, any> = {};

      for (const product of products) {
        const categoryName = product.subcategory.category.name;
        const subcategoryName = product.subcategory.name;

        // Crear estructura de categoría si no existe
        if (!menuStructure[categoryName]) {
          menuStructure[categoryName] = {};
        }

        // Crear estructura de subcategoría si no existe
        if (!menuStructure[categoryName][subcategoryName]) {
          menuStructure[categoryName][subcategoryName] = [];
        }

        // Crear estructura del producto
        const productStructure: any = {
          nombre: product.name,
          descripcion: product.description
        };

        // Agregar variantes si existen
        if (product.variants.length > 0) {
          productStructure.variantes = product.variants.map(v => v.name);
        }

        // Agregar modificadores si existen
        if (product.modifierGroups.length > 0) {
          productStructure.modificadores = {};
          
          for (const group of product.modifierGroups) {
            if (group.productModifiers.length > 0) {
              productStructure.modificadores[group.name] = group.productModifiers.map(m => m.name);
            }
          }
        }

        // Agregar personalizaciones de pizza si es una pizza
        if (product.isPizza && product.pizzaCustomizations.length > 0) {
          const flavors = product.pizzaCustomizations.filter((c: any) => c.type === 'FLAVOR');
          const ingredients = product.pizzaCustomizations.filter((c: any) => c.type === 'INGREDIENT');
          
          productStructure.personalizacionesPizza = {
            sabores: flavors.map(f => f.name),
            ingredientes: ingredients.map(i => i.name)
          };
        }

        menuStructure[categoryName][subcategoryName].push(productStructure);
      }

      return menuStructure;
    } catch (error) {
      logger.error('Error getting menu structure for AI:', error);
      throw error;
    }
  }

}