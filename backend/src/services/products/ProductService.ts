import { prisma } from '../../lib/prisma';
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
    formatForWhatsApp?: boolean;
    restaurantName?: string;
  }): Promise<Product[] | string> {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: options?.includeRelations !== false ? {
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

      // Obtener nombre del restaurante si no se proporciona
      let restaurantName = options?.restaurantName;
      if (!restaurantName && (options?.formatForAI || options?.formatForWhatsApp)) {
        try {
          const { RestaurantService } = await import('../restaurant/RestaurantService');
          const config = await RestaurantService.getConfig();
          restaurantName = config.restaurantName;
        } catch (error) {
          restaurantName = "Nuestro Restaurante";
        }
      }

      // Si se solicita formato para WhatsApp, usar formato simplificado
      if (options?.formatForWhatsApp) {
        return this.formatMenuForWhatsApp(products, restaurantName);
      }

      // Si se solicita formato para AI, formatear el menú con markdown
      if (options?.formatForAI) {
        return this.formatMenuForAI(products, restaurantName);
      }

      return products;
    } catch (error) {
      logger.error('Error fetching active products:', error);
      throw error;
    }
  }

  /**
   * Format menu for WhatsApp - Simple and clean format
   */
  private static formatMenuForWhatsApp(products: any[], restaurantName: string = "Nuestro Restaurante"): string {
    let menuText = `🍽️ MENÚ ${restaurantName.toUpperCase()}\n`;
    menuText += "━━━━━━━━━━━━━━━━━━━━━━\n";

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
      menuText += `\n▪️ *${category.toUpperCase()}*\n`;
      
      // Productos ya vienen ordenados por sortOrder desde la consulta
      for (const product of (data as any).products) {
        menuText += `${product.name}`;
        
        // Precio si no tiene variantes
        if (!product.hasVariants && product.price) {
          menuText += ` - $${product.price.toFixed(2)}`;
        }
        menuText += '\n';
        
        // Variantes con precios (ya ordenadas)
        if (product.variants?.length > 0 && product.hasVariants) {
          for (const variant of product.variants) {
            menuText += ` • ${variant.name}: $${variant.price.toFixed(2)}\n`;
          }
        }
        
        // Mostrar modificadores si existen
        if (product.modifierGroups?.length > 0) {
          for (const group of product.modifierGroups) {
            const activeModifiers = group.productModifiers?.filter((m: any) => m.isActive) || [];
            if (activeModifiers.length > 0) {
              // Solo mostrar los primeros 3 modificadores para ahorrar espacio
              const modifiersToShow = activeModifiers.slice(0, 3);
              const modifierNames = modifiersToShow.map((m: any) => m.name).join(', ');
              if (activeModifiers.length > 3) {
                menuText += ` _Extras: ${modifierNames}, +${activeModifiers.length - 3} más_\n`;
              } else {
                menuText += ` _Extras: ${modifierNames}_\n`;
              }
              break; // Solo mostrar el primer grupo con modificadores
            }
          }
        }
      }
    }

    menuText += "\n━━━━━━━━━━━━━━━━━━━━━━\n";
    menuText += "📱 Para ordenar: menciona el producto";

    return menuText;
  }

  /**
   * Format menu for AI consumption
   */
  private static formatMenuForAI(products: any[], restaurantName: string = "Nuestro Restaurante"): string {
    let menuText = `🍽️ **MENÚ DE ${restaurantName.toUpperCase()}** 🍽️\n`;
    menuText += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

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

    // Mapeo de emojis por tipo de categoría (genérico)
    const categoryEmojis: Record<string, string> = {
      'pizza': '🍕',
      'pizzas': '🍕',
      'hamburguesa': '🍔',
      'hamburguesas': '🍔',
      'bebida': '🥤',
      'bebidas': '🥤',
      'postre': '🍰',
      'postres': '🍰',
      'ensalada': '🥗',
      'ensaladas': '🥗',
      'pasta': '🍝',
      'pastas': '🍝',
      'sandwich': '🥪',
      'sandwiches': '🥪',
      'sushi': '🍱',
      'comida china': '🥡',
      'tacos': '🌮',
      'mexicana': '🌮',
      'desayuno': '🍳',
      'desayunos': '🍳',
      'café': '☕',
      'cafés': '☕',
      'sopa': '🍲',
      'sopas': '🍲',
      'mariscos': '🦐',
      'pescados': '🐟',
      'pollo': '🍗',
      'carne': '🥩',
      'carnes': '🥩',
      'vegano': '🌱',
      'vegetariano': '🥦',
      'combo': '🍱',
      'combos': '🍱',
      'promoción': '⭐',
      'promociones': '⭐'
    };

    // Función para obtener emoji apropiado
    const getEmoji = (categoryName: string): string => {
      const lowerName = categoryName.toLowerCase();
      for (const [key, emoji] of Object.entries(categoryEmojis)) {
        if (lowerName.includes(key)) {
          return emoji;
        }
      }
      return '🍽️'; // Emoji por defecto
    };

    // Formatear por categoría y subcategoría
    for (const [category, subcategories] of Object.entries(productsByCategory)) {
      const emoji = getEmoji(category);
      
      menuText += `\n${emoji} **${category.toUpperCase()}** ${emoji}\n`;
      menuText += `${'─'.repeat(30)}\n\n`;
      
      for (const [subcategory, data] of Object.entries(subcategories as Record<string, any>)) {
        if (subcategory !== 'Sin subcategoría') {
          menuText += `▸ _${subcategory}_\n\n`;
        }
        
        const categoryProducts = data.products;
        
        for (const product of categoryProducts) {
          // Nombre del producto
          menuText += `  **${product.name}**`;
          
          // Precio si no tiene variantes
          if (!product.hasVariants && product.price) {
            menuText += ` ─ $${product.price.toFixed(2)}`;
          }
          
          menuText += '\n';
          
          // Variantes con precios
          if (product.variants?.length > 0 && product.hasVariants) {
            for (const variant of product.variants) {
              menuText += `    • ${variant.name}: **$${variant.price.toFixed(2)}**\n`;
            }
          }
          
          // Personalizaciones de pizza (si aplica)
          if (product.pizzaCustomizations?.length > 0 && product.isPizza) {
            const flavors = product.pizzaCustomizations.filter((c: any) => c.type === 'FLAVOR');
            const ingredients = product.pizzaCustomizations.filter((c: any) => c.type === 'INGREDIENT');
            
            if (flavors.length > 0) {
              menuText += `    _Sabores disponibles: ${flavors.map((f: any) => f.name).join(', ')}_\n`;
            }
            if (ingredients.length > 0) {
              menuText += `    _Ingredientes extra: ${ingredients.map((i: any) => i.name).join(', ')}_\n`;
            }
          }
          
          // Modificadores disponibles
          if (product.modifierGroups?.length > 0) {
            for (const modGroup of product.modifierGroups) {
              if (modGroup.productModifiers?.length > 0) {
                menuText += `\n    **${modGroup.name}**\n`;
                for (const mod of modGroup.productModifiers) {
                  const price = mod.price ? `+$${mod.price.toFixed(2)}` : 'Sin costo';
                  menuText += `      ○ ${mod.name} (${price})\n`;
                }
              }
            }
          }
          
          menuText += "\n";
        }
      }
    }

    // Agregar información adicional
    menuText += "\n━━━━━━━━━━━━━━━━━━━━━━\n";
    menuText += "💡 **Cómo ordenar:**\n";
    menuText += "• Menciona el nombre del producto\n";
    menuText += "• Especifica el tamaño si hay variantes\n";
    menuText += "• Indica modificadores si deseas\n";
    menuText += "━━━━━━━━━━━━━━━━━━━━━━\n";

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