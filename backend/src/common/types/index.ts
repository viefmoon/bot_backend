/**
 * Central type export file
 * All common types should be imported from here
 */

// Order types
export * from './order.types';
export * from './otp.types';

// Menu types
export * from './menu';

// Restaurant types
export * from './restaurant';

// WhatsApp & Webhook types
export * from './whatsapp.types';
export * from './webhook.types';

// Response types are now in messaging/types/responses

// Agent types removed - using unified agent now

// Service types
export * from './services.types';

// Re-export commonly used Prisma types
export type {
  Customer,
  Order,
  OrderType,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductVariant,
  Category,
  Subcategory,
  Modifier,
  ModifierType,
  PizzaIngredient,
  PizzaHalf,
  IngredientAction,
  PreOrder,
  RestaurantConfig,
  BusinessHours
} from '@prisma/client';