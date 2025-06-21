/**
 * Service-specific types that are used across multiple services
 */

// Delivery Info types (compatible with Address model)
export interface DeliveryInfoInput {
  street?: string | null;
  number?: string | null;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  references?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

// Product Calculation types
export interface OrderItemInput {
  productId?: string;
  productVariantId?: string;
  quantity: number;
  comments?: string;
  selectedModifiers?: string[];
  selectedPizzaCustomizations?: Array<{
    pizzaCustomizationId: string;
    half: string;
    action: string;
  }>;
}

export interface CalculatedItem {
  product: any;
  productVariant: any;
  quantity: number;
  itemPrice: number;
  comments?: string;
  modifiers: any[];
  pizzaCustomizations: any[];
}

// AI Context types
export enum ContextType {
  NEW_ORDER = "nuevo_pedido",
  CUSTOMER_SERVICE = "servicio_cliente",
  GENERAL_INQUIRY = "consulta_general",
  MENU_INQUIRY = "consulta_menu",
  COMPLAINT = "queja",
  UNKNOWN = "desconocido"
}

// Order Management types
export interface OrderCreationResult {
  order: any;
  formattedOrder: any;
  message: string;
}

export interface PreOrderCreationResult {
  preOrderId: number;
  products: any[];
  totalCost: number;
  estimatedTime: number;
}