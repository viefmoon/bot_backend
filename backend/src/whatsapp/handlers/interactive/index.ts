/**
 * Interactive message handlers registry
 * Exports all handlers and constructs the unified action registry
 */
import { INTERACTIVE_ACTIONS, startsWithAction } from '../../../common/constants/interactiveActions';

// Import all domain-specific handlers
import {
  handlePreOrderAction,
  handlePreOrderChangeAddress
} from './preOrderActions';

import {
  handleChangeDeliveryInfo,
  handleAddressSelection,
  handleAddNewAddress,
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

// Export all handlers for individual use
export * from './preOrderActions';
export * from './addressActions';
export * from './infoActions';
export * from './paymentActions';

// Import UnifiedResponse for type definition
import { UnifiedResponse } from '../../../services/messaging/types';

// Handler type definition - now returns UnifiedResponse
type InteractiveHandler = (from: string, id: string) => Promise<void | UnifiedResponse | UnifiedResponse[]>;

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
  [INTERACTIVE_ACTIONS.ADD_NEW_ADDRESS, async (from, id) => handleAddNewAddress(from)],
  
  // Button actions (prefix match)
  [INTERACTIVE_ACTIONS.PREORDER_CONFIRM, handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_DISCARD, handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_CHANGE_ADDRESS, handlePreOrderChangeAddress],
  [INTERACTIVE_ACTIONS.SELECT_ADDRESS, handleAddressSelection],
  [INTERACTIVE_ACTIONS.PAY_ONLINE, handleOnlinePaymentWithId],
  ['add_new_address_preorder', async (from, id) => {
    // Special case: parse preOrderId from id
    if (id.includes(':')) {
      const preOrderId = parseInt(id.split(':')[1], 10);
      await handleAddNewAddressForPreOrder(from, preOrderId);
    } else {
      await handleAddNewAddressFromButton(from, id);
    }
  }],
  ['select_address', handleAddressSelectionButton],
  
  // Special case handlers with full ID
  [INTERACTIVE_ACTIONS.CHANGE_ADDRESS, async (from, id) => handleChangeDeliveryInfo(from)],
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