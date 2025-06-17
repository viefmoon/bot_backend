import { prisma } from "../../server";
import { ValidationError, ErrorCode } from "../../common/services/errors";
import logger from "../../common/utils/logger";
import { OrderItemInput, CalculatedItem } from "../../common/types";

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

    const modifiers = await prisma.modifier.findMany({
      where: { 
        id: { in: selectedModifierIds },
        modifierType: productId ? { productId } : undefined
      },
      include: { modifierType: true }
    });

    // Validate all modifiers were found
    if (modifiers.length !== selectedModifierIds.length) {
      const foundIds = modifiers.map(m => m.id);
      const notFoundIds = selectedModifierIds.filter(id => !foundIds.includes(id));
      
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        `Modifiers not found: ${notFoundIds.join(', ')}`,
        { metadata: { notFoundIds, productId } }
      );
    }

    // Group by modifier type and validate
    const modifiersByType = modifiers.reduce((acc, mod) => {
      const typeId = mod.modifierType.id;
      if (!acc[typeId]) {
        acc[typeId] = {
          type: mod.modifierType,
          modifiers: []
        };
      }
      acc[typeId].modifiers.push(mod);
      return acc;
    }, {} as Record<string, { type: any; modifiers: any[] }>);

    // Validate modifier selection rules
    for (const { type, modifiers: typeModifiers } of Object.values(modifiersByType)) {
      if (type.required && typeModifiers.length === 0) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Required modifier type ${type.name} must have at least one selection`, { metadata: { modifierTypeName: type.name } });
      }

      if (!type.acceptsMultiple && typeModifiers.length > 1) {
        throw new ValidationError(ErrorCode.INVALID_PRODUCT, `Modifier type ${type.name} only accepts one selection`, { metadata: { modifierTypeName: type.name, selectedCount: typeModifiers.length } });
      }
    }

    const totalPrice = modifiers.reduce((sum, mod) => sum + mod.price, 0);

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
        productId: productId || undefined
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