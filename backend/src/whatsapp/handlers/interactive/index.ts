/**
 * Interactive message handlers registry
 * Exports all handlers and constructs the unified action registry
 */
import { INTERACTIVE_ACTIONS, startsWithAction } from '../../../common/constants/interactiveActions';

// Import all domain-specific handlers
import {
  handlePreOrderAction,
  handlePreOrderChangeType,
  handleSelectOrderType
} from './preorderActions';

import {
  handleChangeDeliveryInfo,
  handleAddressSelection,
  handleAddNewAddressForPreOrder,
  handleAddNewAddressFromButton,
  handleAddressSelectionButton
} from './addressActions';

import {
  sendMenu,
  handleWaitTimes,
  handleRestaurantInfo,
  handleChatbotHelp
} from './infoActions';

import {
  handleOnlinePaymentWithId
} from './paymentActions';

import {
  handleRequestDeliveryRegistration,
  handleRequestPickupRegistration
} from './registrationActions';

// Export all handlers for individual use
export * from './preorderActions';
export * from './addressActions';
export * from './infoActions';
export * from './paymentActions';
export * from './registrationActions';

// Import UnifiedResponse for type definition
import { UnifiedResponse } from '../../../services/messaging/types';
import { MessageContext } from '../../../services/messaging/MessageContext';

// Handler type definition - now returns UnifiedResponse
type InteractiveHandler = (from: string, id: string, context?: MessageContext) => Promise<void | UnifiedResponse | UnifiedResponse[]>;

/**
 * Unified action registry for all interactive messages
 * Maps action IDs to their corresponding handlers
 */
export const actionRegistry = new Map<string, InteractiveHandler>([
  // List actions (exact match) - now return UnifiedResponse
  [INTERACTIVE_ACTIONS.WAIT_TIMES, async (from, id) => handleWaitTimes(from)],
  [INTERACTIVE_ACTIONS.VIEW_MENU, async (from, id) => sendMenu(from)],
  [INTERACTIVE_ACTIONS.RESTAURANT_INFO, async (from, id) => handleRestaurantInfo(from)],
  [INTERACTIVE_ACTIONS.CHATBOT_HELP, async (from, id) => handleChatbotHelp(from)],
  [INTERACTIVE_ACTIONS.CHANGE_DELIVERY_INFO, async (from, id) => handleChangeDeliveryInfo(from)],
  
  // Button actions (prefix match)
  [INTERACTIVE_ACTIONS.PREORDER_CONFIRM, handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_DISCARD, handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_CHANGE_TYPE, handlePreOrderChangeType],
  [INTERACTIVE_ACTIONS.SELECT_ORDER_TYPE, handleSelectOrderType],
  [INTERACTIVE_ACTIONS.SELECT_ADDRESS, handleAddressSelection],
  [INTERACTIVE_ACTIONS.PAY_ONLINE, handleOnlinePaymentWithId],
  [INTERACTIVE_ACTIONS.ADD_NEW_ADDRESS_PREORDER, async (from, id) => {
    // Special case: parse preOrderId from id
    if (id.includes(':')) {
      const preOrderId = parseInt(id.split(':')[1], 10);
      await handleAddNewAddressForPreOrder(from, preOrderId);
    } else {
      await handleAddNewAddressFromButton(from, id);
    }
  }],
  [INTERACTIVE_ACTIONS.SELECT_ADDRESS, handleAddressSelectionButton],
  
  // Registration flow handlers
  [INTERACTIVE_ACTIONS.REQUEST_DELIVERY_REGISTRATION, async (from, id) => handleRequestDeliveryRegistration(from)],
  [INTERACTIVE_ACTIONS.REQUEST_PICKUP_REGISTRATION, async (from, id) => handleRequestPickupRegistration(from)],
]);

/**
 * Find handler for an interactive action ID.
 * Supports both exact matches and prefix-based matches.
 * This revised version is more robust.
 */
export function findHandler(actionId: string): InteractiveHandler | undefined {
  // 1. First, try for an exact match for performance.
  let handler = actionRegistry.get(actionId);
  if (handler) {
    return handler;
  }

  // 2. If no exact match, try a prefix-based match.
  // Sort keys by length in descending order to match the most specific prefix first
  // (e.g., to prevent 'prefix' from matching before 'prefix_sub').
  const sortedKeys = Array.from(actionRegistry.keys()).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    // Check if the actionId starts with a known key.
    // This works for keys like 'preorder_confirm:' and 'select_address_'.
    if (actionId.startsWith(key)) {
      return actionRegistry.get(key);
    }
  }

  // 3. If no handler is found, return undefined.
  return undefined;
}