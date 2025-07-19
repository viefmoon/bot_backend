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