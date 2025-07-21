/**
 * Constants for interactive message actions
 * These are used as prefixes or identifiers in WhatsApp interactive messages
 */
export const INTERACTIVE_ACTIONS = {
  // PreOrder actions
  PREORDER_CONFIRM: 'preorder_confirm:',
  PREORDER_DISCARD: 'preorder_discard:',
  PREORDER_CHANGE_TYPE: 'preorder_change_type:',
  
  // Order type selection
  SELECT_ORDER_TYPE: 'select_order_type',
  
  // Address actions
  SELECT_ADDRESS: 'select_address_',
  ADD_NEW_ADDRESS_PREORDER: 'add_new_address_preorder',
  
  // Order actions
  PAY_ONLINE: 'pay_online',
  
  // Menu and info actions
  VIEW_MENU: 'view_menu',
  RESTAURANT_INFO: 'restaurant_info',
  WAIT_TIMES: 'wait_times',
  CHATBOT_HELP: 'chatbot_help',
  CHANGE_DELIVERY_INFO: 'change_delivery_info',
  
  // Registration flow actions
  REQUEST_DELIVERY_REGISTRATION: 'request_delivery_registration',
  REQUEST_PICKUP_REGISTRATION: 'request_pickup_registration',
} as const;

/**
 * Type-safe way to check if a string starts with an action prefix
 */
export function startsWithAction(str: string, action: string): boolean {
  return str.startsWith(action);
}

/**
 * Extract the ID from an action string
 * For example: 'select_address_123' -> '123'
 */
export function extractIdFromAction(str: string, actionPrefix: string): string {
  if (!startsWithAction(str, actionPrefix)) {
    throw new Error(`String does not start with action prefix: ${actionPrefix}`);
  }
  return str.substring(actionPrefix.length);
}

