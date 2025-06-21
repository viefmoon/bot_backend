/**
 * Order handlers index
 * Exports all order-related handlers
 */

// Order confirmation moved to OrderManagementService

export { 
  handleOrderCancellation 
} from './cancellationHandler';

export {
  generateProductSummary,
  generateOrderSummary
} from './orderFormatters';