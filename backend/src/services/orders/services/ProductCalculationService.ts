import { prisma } from "../../../server";
import { ValidationError, ErrorCode } from "../../../common/services/errors";
import logger from "../../../common/utils/logger";
import { OrderItemInput, CalculatedItem } from "../../../common/types";

export class ProductCalculationService {
  /**
   * Calculate items and prices for an order
   */
  static async calculateOrderItems(orderItems: OrderItemInput[]): Promise<{
    items: CalculatedItem[];
    totalCost: number;
  }> {
    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => await this.calculateSingleItem(item))
    );

    const totalCost = calculatedItems.reduce((sum, item) => sum + item.itemPrice, 0);

    return {
      items: calculatedItems,
      totalCost
    };
  }

  /**
   * Calculate a single order item
   */
  private static async calculateSingleItem(item: OrderItemInput): Promise<CalculatedItem> {
    logger.info("Processing item:", JSON.stringify(item, null, 2));

    let product, productVariant;
    let itemPrice = 0;
    
    logger.info(`Starting calculation for item with productId: ${item.productId}, variantId: ${item.productVariantId}`);

    // Get product and variant
    if (item.productId) {
      product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Product not found: ${item.productId}`, { metadata: { productId: item.productId } });
      }
    }

    if (item.productVariantId) {
      productVariant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        include: { product: true }
      });

      if (!productVariant) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Product variant not found: ${item.productVariantId}`, { metadata: { productVariantId: item.productVariantId } });
      }

      product = productVariant.product;
      itemPrice = productVariant.price;
      logger.info(`Found variant ${productVariant.name} with price: ${productVariant.price}`);
    } else if (product && product.price !== null) {
      // If no variant but product has price, use product price
      itemPrice = product.price;
      logger.info(`Using product price: ${product.price}`);
    }

    if (!product && !productVariant) {
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        'Either productId or productVariantId must be provided',
        { metadata: { item } }
      );
    }

    // Calculate modifiers
    const modifiers = await this.calculateModifiers(item.selectedModifiers || [], product?.id);
    itemPrice += modifiers.totalPrice;

    // Calculate pizza ingredients
    const pizzaIngredients = await this.calculatePizzaIngredients(
      item.selectedPizzaIngredients || [],
      product?.id
    );

    // Total item price
    itemPrice = itemPrice * item.quantity;
    
    logger.info(`Final item price after quantity (${item.quantity}): ${itemPrice}`);

    return {
      product,
      productVariant,
      quantity: item.quantity,
      itemPrice,
      comments: item.comments,
      modifiers: modifiers.items,
      pizzaIngredients
    };
  }

  /**
   * Calculate modifiers for a product
   */
  private static async calculateModifiers(
    selectedModifierIds: string[],
    productId?: string
  ): Promise<{ items: any[]; totalPrice: number }> {
    if (!selectedModifierIds.length) {
      return { items: [], totalPrice: 0 };
    }

    const modifiers = await prisma.productModifier.findMany({
      where: { 
        id: { in: selectedModifierIds }
      },
      include: { modifierGroup: true }
    });

    // Validate all modifiers were found
    if (modifiers.length !== selectedModifierIds.length) {
      const foundIds = modifiers.map((m: any) => m.id);
      const notFoundIds = selectedModifierIds.filter(id => !foundIds.includes(id));
      
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        `Modifiers not found: ${notFoundIds.join(', ')}`,
        { metadata: { notFoundIds, productId } }
      );
    }

    // Group by modifier group and validate
    const modifiersByGroup = modifiers.reduce((acc: any, mod: any) => {
      const groupId = mod.modifierGroup.id;
      if (!acc[groupId]) {
        acc[groupId] = {
          group: mod.modifierGroup,
          modifiers: []
        };
      }
      acc[groupId].modifiers.push(mod);
      return acc;
    }, {} as Record<string, { group: any; modifiers: any[] }>);

    // Validate modifier selection rules
    for (const groupData of Object.values(modifiersByGroup)) {
      const { group, modifiers: groupModifiers } = groupData as { group: any; modifiers: any[] };
      if (group.required && groupModifiers.length === 0) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Required modifier group ${group.name} must have at least one selection`, { metadata: { modifierGroupName: group.name } });
      }

      if (!group.acceptsMultiple && groupModifiers.length > 1) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Modifier group ${group.name} only accepts one selection`, { metadata: { modifierGroupName: group.name, selectedCount: groupModifiers.length } });
      }
    }

    const totalPrice = modifiers.reduce((sum: number, mod: any) => sum + mod.price, 0);

    return {
      items: modifiers,
      totalPrice
    };
  }

  /**
   * Calculate pizza ingredients
   */
  private static async calculatePizzaIngredients(
    selectedIngredients: Array<{
      pizzaIngredientId: string;
      half: string;
      action: string;
    }>,
    productId?: string
  ): Promise<any[]> {
    if (!selectedIngredients.length) {
      return [];
    }

    const ingredientIds = selectedIngredients.map(i => i.pizzaIngredientId);
    const ingredients = await prisma.pizzaIngredient.findMany({
      where: {
        id: { in: ingredientIds },
        products: productId ? { some: { id: productId } } : undefined
      }
    });

    // Validate all ingredients were found
    if (ingredients.length !== ingredientIds.length) {
      const foundIds = ingredients.map(i => i.id);
      const notFoundIds = ingredientIds.filter(id => !foundIds.includes(id));
      
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        `Pizza ingredients not found: ${notFoundIds.join(', ')}`,
        { metadata: { notFoundIds, productId } }
      );
    }

    // Map ingredients with their selection details
    return selectedIngredients.map(selected => {
      const ingredient = ingredients.find(i => i.id === selected.pizzaIngredientId);
      return {
        ...ingredient,
        half: selected.half,
        action: selected.action
      };
    });
  }
}