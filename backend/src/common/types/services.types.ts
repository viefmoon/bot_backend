/**
 * Service-specific types that are used across multiple services
 */

// Delivery Info types (compatible with DeliveryInfo model)
export interface DeliveryInfoInput {
  fullAddress?: string | null;
  street?: string | null;
  number?: string | null;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
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
  subtotal: number;
  total: number;
  estimatedDeliveryTime: number;
}