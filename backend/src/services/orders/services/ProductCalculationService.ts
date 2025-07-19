import { prisma } from '../../../lib/prisma';
import { CustomizationAction, PizzaHalf } from '@prisma/client';
import { ValidationError, ErrorCode } from "../../../common/services/errors";
import logger from "../../../common/utils/logger";
import { BaseOrderItem, CalculatedOrderItem } from "../../../common/types";

export class ProductCalculationService {
  /**
   * Calculate items and prices for an order
   */
  static async calculateOrderItems(orderItems: BaseOrderItem[]): Promise<{
    items: CalculatedOrderItem[];
    subtotal: number;
    total: number;
  }> {
    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => await this.calculateSingleItem(item))
    );

    const subtotal = calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal; // For now, total = subtotal. Can add taxes, fees, etc. later

    return {
      items: calculatedItems,
      subtotal,
      total
    };
  }

  /**
   * Calculate a single order item
   */
  private static async calculateSingleItem(item: BaseOrderItem): Promise<CalculatedOrderItem> {
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
      
      // Validate that products with variants must have a variant selected
      if (product.hasVariants && !item.productVariantId) {
        // Get available variants for this product
        const variants = await prisma.productVariant.findMany({
          where: { 
            productId: product.id,
            isActive: true 
          },
          select: {
            id: true,
            name: true
          }
        });
        throw new ValidationError(
          ErrorCode.INVALID_PRODUCT, 
          `El producto "${product.name}" requiere seleccionar una variante`, 
          { 
            metadata: { 
              productId: item.productId,
              productName: product.name,
              validationFailure: 'MISSING_REQUIRED_VARIANT',
              availableVariants: variants,
              requiresVariant: true
            } 
          }
        );
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

    // Calculate pizza customizations and extra costs
    const { customizations, extraCost } = await this.calculatePizzaCustomizations(
      item.selectedPizzaCustomizations || [],
      product
    );
    
    // Add pizza extra cost to item price
    itemPrice += extraCost;

    // Since we now handle quantities by creating multiple items,
    // each item's price is just its unit price (no multiplication)
    
    logger.info(`Final item price: ${itemPrice}`);

    // At this point, product is guaranteed to exist due to validation above
    if (!product) {
      throw new ValidationError(ErrorCode.INVALID_PRODUCT, 'Product not found');
    }

    // Build the calculated item with only necessary data
    const calculatedItem: CalculatedOrderItem = {
      productId: product.id,
      productVariantId: productVariant?.id || null,
      quantity: 1, // Always 1 since we handle quantities by creating multiple items
      comments: item.comments,
      selectedModifiers: item.selectedModifiers,
      selectedPizzaCustomizations: item.selectedPizzaCustomizations,
      // Pricing information
      basePrice: productVariant?.price || product.price || 0,
      modifiersPrice: modifiers.totalPrice,
      unitPrice: itemPrice,
      totalPrice: itemPrice, // totalPrice equals unitPrice since quantity is always 1
      // Display information
      productName: product.name,
      variantName: productVariant?.name || null,
      // Add modifier names for display
      modifierNames: modifiers.items.map((mod: any) => mod.name),
      // Add pizza customization details for display
      pizzaCustomizationDetails: customizations.map((cust: any) => ({
        pizzaCustomizationId: cust.id,
        name: cust.name,
        type: cust.type,
        half: item.selectedPizzaCustomizations?.find(sc => sc.pizzaCustomizationId === cust.id)?.half || 'FULL',
        action: item.selectedPizzaCustomizations?.find(sc => sc.pizzaCustomizationId === cust.id)?.action || 'ADD'
      }))
    };

    return calculatedItem;
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
   * Calculate pizza customizations and extra costs
   */
  private static async calculatePizzaCustomizations(
    selectedCustomizations: Array<{
      pizzaCustomizationId: string;
      half: string;
      action: string;
    }>,
    product: any | null
  ): Promise<{ customizations: any[]; extraCost: number }> {
    if (!selectedCustomizations.length || !product?.isPizza) {
      return { customizations: [], extraCost: 0 };
    }

    // Get pizza configuration
    const pizzaConfig = await prisma.pizzaConfiguration.findUnique({
      where: { productId: product.id }
    });

    if (!pizzaConfig) {
      logger.warn(`No pizza configuration found for product ${product.id}`);
      return { customizations: [], extraCost: 0 };
    }

    const customizationIds = selectedCustomizations.map(c => c.pizzaCustomizationId);
    const customizations = await prisma.pizzaCustomization.findMany({
      where: {
        id: { in: customizationIds },
        products: { some: { id: product.id } }
      }
    });

    // Validate all customizations were found
    if (customizations.length !== customizationIds.length) {
      const foundIds = customizations.map(c => c.id);
      const notFoundIds = customizationIds.filter(id => !foundIds.includes(id));
      
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        `Pizza customizations not found: ${notFoundIds.join(', ')}`,
        { metadata: { notFoundIds, productId: product.id } }
      );
    }

    // Calculate total topping value for ADD actions only
    let totalToppingValue = 0;
    const mappedCustomizations = selectedCustomizations.map(selected => {
      const customization = customizations.find(c => c.id === selected.pizzaCustomizationId);
      
      if (selected.action === CustomizationAction.ADD && customization) {
        if (selected.half === PizzaHalf.FULL) {
          totalToppingValue += customization.toppingValue;
        } else {
          // Half pizza counts as half the topping value
          totalToppingValue += customization.toppingValue / 2;
        }
      }
      
      return {
        ...customization,
        half: selected.half,
        action: selected.action
      };
    });

    // Calculate extra cost if toppings exceed included amount
    let extraCost = 0;
    if (totalToppingValue > pizzaConfig.includedToppings) {
      const extraToppings = totalToppingValue - pizzaConfig.includedToppings;
      extraCost = extraToppings * pizzaConfig.extraToppingCost;
      logger.info(`Pizza extra cost: ${extraCost} (${extraToppings} extra toppings at ${pizzaConfig.extraToppingCost} each)`);
    }

    return {
      customizations: mappedCustomizations,
      extraCost
    };
  }
  
}