/**
 * Order handlers index
 * Exports all order-related handlers
 */

export { 
  handlePreOrderConfirmation,
  sendOrderConfirmation 
} from './confirmationHandler';

export { 
  handleOrderCancellation 
} from './cancellationHandler';

export { 
  handleOrderModification 
} from './modificationHandler';

export {
  createPreOrderAndSendSummary,
  handlePreOrderDiscard
} from './preOrderHandler';

export {
  generateProductSummary,
  generatePizzaIngredientsSummary,
  generateOrderSummary
} from './orderFormatters';