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

// Handler type definition
type InteractiveHandler = (from: string, id: string) => Promise<void>;

/**
 * Unified action registry for all interactive messages
 * Maps action IDs to their corresponding handlers
 */
export const actionRegistry = new Map<string, InteractiveHandler>([
  // List actions (exact match)
  [INTERACTIVE_ACTIONS.WAIT_TIMES, async (from, id) => handleWaitTimes(from)],
  [INTERACTIVE_ACTIONS.VIEW_MENU, async (from, id) => sendMenu(from)],
  [INTERACTIVE_ACTIONS.RESTAURANT_INFO, async (from, id) => handleRestaurantInfo(from)],
  [INTERACTIVE_ACTIONS.CHATBOT_HELP, async (from, id) => handleChatbotHelp(from)],
  [INTERACTIVE_ACTIONS.CHANGE_DELIVERY_INFO, async (from, id) => handleChangeDeliveryInfo(from)],
  [INTERACTIVE_ACTIONS.ADD_NEW_ADDRESS, async (from, id) => handleAddNewAddress(from)],
  
  // Button actions (prefix match - remove trailing colon)
  [INTERACTIVE_ACTIONS.PREORDER_CONFIRM.slice(0, -1), handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_DISCARD.slice(0, -1), handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_CHANGE_ADDRESS.slice(0, -1), handlePreOrderChangeAddress],
  [INTERACTIVE_ACTIONS.SELECT_ADDRESS.slice(0, -1), handleAddressSelection],
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
 * Find handler for an interactive action ID
 * Supports both exact matches and prefix-based matches
 */
export function findHandler(actionId: string): InteractiveHandler | undefined {
  // First, try exact match
  let handler = actionRegistry.get(actionId);
  
  // If no exact match, try prefix match for actions with parameters
  if (!handler) {
    const [actionPrefix] = actionId.split(':');
    handler = actionRegistry.get(actionPrefix);
    
    // Special handling for actions that start with a prefix
    if (!handler && actionId.includes(':')) {
      // Check for actions that use startsWithAction pattern
      for (const [key, value] of actionRegistry) {
        if (actionId.startsWith(key + ':')) {
          handler = value;
          break;
        }
      }
    }
  }
  
  return handler;
}