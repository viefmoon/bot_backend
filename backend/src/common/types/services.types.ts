/**
 * Service-specific types that are used across multiple services
 */

// Delivery Info types
export interface DeliveryInfoInput {
  streetAddress?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAddress?: string | null;
  additionalDetails?: string | null;
  pickupName?: string | null;
}

// Product Calculation types
export interface OrderItemInput {
  productId?: string;
  productVariantId?: string;
  quantity: number;
  comments?: string;
  selectedModifiers?: string[];
  selectedPizzaIngredients?: Array<{
    pizzaIngredientId: string;
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
  pizzaIngredients: any[];
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