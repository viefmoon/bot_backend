/**
 * Types for the PreOrder workflow system
 */

export interface ProcessedOrderData {
  orderItems: Array<{
    productId: string;
    productVariantId?: string | null;
    quantity: number;
    selectedModifiers?: string[];
    selectedPizzaCustomizations?: Array<{
      pizzaCustomizationId: string;
      half: 'FULL' | 'HALF_1' | 'HALF_2';
      action: 'ADD' | 'REMOVE';
    }>;
  }>;
  orderType: 'DELIVERY' | 'TAKE_AWAY';
  scheduledAt?: Date | null;
  deliveryInfo?: {
    name?: string | null;
    street?: string;
    number?: string;
    interiorNumber?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    deliveryInstructions?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
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