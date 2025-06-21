/**
 * Types for the PreOrder workflow system
 */

export interface ProcessedOrderData {
  orderItems: Array<{
    productId: string;
    productVariantId?: string | null;
    quantity: number;
    selectedModifiers?: string[];
    selectedPizzaIngredients?: Array<{
      pizzaIngredientId: string;
      half: 'LEFT' | 'RIGHT' | 'FULL';
      action: 'ADD' | 'REMOVE';
    }>;
  }>;
  orderType: 'DELIVERY' | 'TAKE_AWAY';
  scheduledAt?: Date | null;
}

export interface PreOrderWorkflowResult {
  preOrderId: number;
  actionToken: string;
  expiresAt: Date;
}

export interface PreOrderActionParams {
  action: 'confirm' | 'discard';
  token: string;
  whatsappNumber: string;
}

export interface PreOrderSummary {
  items: Array<{
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiers?: string[];
  }>;
  subtotal: number;
  orderType: string;
  scheduledAt?: Date;
}

export interface PreOrderNotification {
  summary: string;
  actionToken: string;
  expiresInMinutes: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  preOrderId?: number;
  error?: string;
}