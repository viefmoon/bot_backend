/**
 * Unified types for order items throughout the system
 * This file serves as the single source of truth for order item structures
 */

/**
 * Base structure for pizza customizations
 */
export interface PizzaCustomizationData {
  pizzaCustomizationId: string;
  half: 'FULL' | 'HALF_1' | 'HALF_2';
  action: 'ADD' | 'REMOVE';
}

/**
 * Base order item structure used throughout the system
 * This is the canonical format - no field name variations allowed
 */
export interface BaseOrderItem {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
  comments?: string | null;
  selectedModifiers?: string[];
  selectedPizzaCustomizations?: PizzaCustomizationData[];
}

/**
 * Order item as it comes from the AI agent
 * We'll transform this immediately to BaseOrderItem format
 */
export interface AIOrderItem {
  productId: string;
  variantId?: string | null;  // AI uses 'variantId' instead of 'productVariantId'
  quantity: number;
  modifiers?: string[];  // AI uses 'modifiers' instead of 'selectedModifiers'
  pizzaCustomizations?: Array<{
    customizationId: string;  // AI uses 'customizationId' instead of 'pizzaCustomizationId'
    half: string;
    action: string;
  }>;
}

/**
 * Order item with calculated pricing information
 * This is what we store in the PreOrder JSON field
 */
export interface CalculatedOrderItem extends BaseOrderItem {
  basePrice: number;  // Price before modifiers
  modifiersPrice: number;  // Total price of modifiers
  unitPrice: number;  // basePrice + modifiersPrice
  totalPrice: number;  // unitPrice * quantity
  productName: string;  // For display purposes
  variantName?: string | null;  // For display purposes
  // Optional enriched data for display
  modifierNames?: string[];  // Names of selected modifiers
  pizzaCustomizationDetails?: Array<{
    pizzaCustomizationId: string;
    name: string;
    type: 'FLAVOR' | 'INGREDIENT';
    half: 'FULL' | 'HALF_1' | 'HALF_2';
    action: 'ADD' | 'REMOVE';
  }>;
}

/**
 * Order item data for creating an actual Order
 * This matches what OrderService expects
 */
export type CreateOrderItem = BaseOrderItem;

/**
 * Transform AI order item to base format
 */
export function transformAIOrderItem(aiItem: AIOrderItem): BaseOrderItem {
  return {
    productId: aiItem.productId,
    productVariantId: aiItem.variantId || null,
    quantity: aiItem.quantity || 1,
    selectedModifiers: aiItem.modifiers || [],
    selectedPizzaCustomizations: aiItem.pizzaCustomizations?.map(pc => ({
      pizzaCustomizationId: pc.customizationId,
      half: (pc.half || 'FULL') as 'FULL' | 'HALF_1' | 'HALF_2',
      action: (pc.action || 'ADD') as 'ADD' | 'REMOVE'
    })) || []
  };
}

/**
 * Transform calculated item back to base format for order creation
 */
export function extractBaseOrderItem(calculated: CalculatedOrderItem): CreateOrderItem {
  return {
    productId: calculated.productId,
    productVariantId: calculated.productVariantId,
    quantity: calculated.quantity,
    comments: calculated.comments,
    selectedModifiers: calculated.selectedModifiers,
    selectedPizzaCustomizations: calculated.selectedPizzaCustomizations
  };
}