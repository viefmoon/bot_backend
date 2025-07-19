/**
 * Centralized constants for MessageContext keys
 * This prevents typos and makes refactoring easier
 */
export const CONTEXT_KEYS = {
  // Customer state
  IS_NEW_CUSTOMER: 'isNewCustomer',
  HAS_NO_ADDRESS: 'hasNoAddress',
  IS_NEW_CONVERSATION: 'isNewConversation',
  
  // Chat history
  FULL_CHAT_HISTORY: 'fullChatHistory',
  RELEVANT_CHAT_HISTORY: 'relevantChatHistory',
  SKIP_HISTORY_UPDATE: 'skipHistoryUpdate',
  
  // Message processing
  MESSAGE_TYPE: 'messageType',
  NEEDS_TRANSCRIPTION: 'needsTranscription',
  
  // PreOrder flow
  LAST_PREORDER_TOKEN: 'lastPreOrderToken',
  INTERACTIVE_RESPONSE_SENT: 'interactiveResponseSent',
  
  // Conversation state
  IS_RESETTING_CONVERSATION: 'isResettingConversation',
} as const;

// Type for context keys
export type ContextKey = typeof CONTEXT_KEYS[keyof typeof CONTEXT_KEYS];