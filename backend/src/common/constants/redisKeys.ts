/**
 * Centralized constants for Redis key patterns
 * This ensures consistency and prevents typos in Redis operations
 */
export const REDIS_KEYS = {
  // Rate limiting
  RATE_LIMIT_PREFIX: 'rate-limit:',
  
  // OTP verification
  OTP_PREFIX: 'otp:',
  
  // PreOrder management
  PREORDER_TOKEN_PREFIX: 'preorder:token:',
  PREORDER_UPDATING_PREFIX: 'preorder:updating:',
  
  // Message processing locks
  USER_LOCK_PREFIX: 'user-lock:',
  
  // Restaurant data caching
  RESTAURANT_CONFIG: 'restaurant:config',
  RESTAURANT_BUSINESS_HOURS: 'restaurant:business_hours',
  
  // Message cancellation keys
  LATEST_MESSAGE_TIMESTAMP_PREFIX: 'latest-message-timestamp:',
  CURRENT_RUN_PREFIX: 'current-run:',
} as const;

// Helper functions to generate Redis keys
export const redisKeys = {
  // Rate limiting
  rateLimit: (phoneNumber: string) => `${REDIS_KEYS.RATE_LIMIT_PREFIX}${phoneNumber}`,
  
  // OTP
  otp: (phoneNumber: string) => `${REDIS_KEYS.OTP_PREFIX}${phoneNumber}`,
  
  // PreOrder
  preorderToken: (token: string) => `${REDIS_KEYS.PREORDER_TOKEN_PREFIX}${token}`,
  preorderUpdating: (phoneNumber: string) => `${REDIS_KEYS.PREORDER_UPDATING_PREFIX}${phoneNumber}`,
  
  // User locks
  userLock: (userId: string) => `${REDIS_KEYS.USER_LOCK_PREFIX}${userId}`,
  
  // Restaurant (static keys)
  restaurantConfig: () => REDIS_KEYS.RESTAURANT_CONFIG,
  restaurantBusinessHours: () => REDIS_KEYS.RESTAURANT_BUSINESS_HOURS,
  
  // Message cancellation
  latestMessageTimestamp: (userId: string) => `${REDIS_KEYS.LATEST_MESSAGE_TIMESTAMP_PREFIX}${userId}`,
  currentRun: (userId: string) => `${REDIS_KEYS.CURRENT_RUN_PREFIX}${userId}`,
};

// Type for Redis keys
export type RedisKey = typeof REDIS_KEYS[keyof typeof REDIS_KEYS];