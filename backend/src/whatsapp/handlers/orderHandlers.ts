/**
 * Order handlers
 * This file now serves as a compatibility layer that re-exports
 * all order-related handlers from their new modular locations
 */

export {
  handlePreOrderConfirmation,
  sendOrderConfirmation,
  handleOrderCancellation,
  handleOrderModification,
  createPreOrderAndSendSummary,
  handlePreOrderDiscard
} from './orders';