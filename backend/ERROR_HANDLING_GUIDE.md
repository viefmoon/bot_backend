# Error Handling Guide

## Overview

This document outlines the error handling patterns used in the WhatsApp bot backend after the refactoring to consolidate error handling and remove redundancy between `globalErrorHandler` and `ErrorService`.

## Error Handling Architecture

### 1. Express Routes (HTTP)
- **Pattern**: Use `asyncHandler` wrapper and throw custom errors
- **Handler**: `globalErrorHandler` middleware catches all errors
- **Example**:
```typescript
router.post('/route', asyncHandler(async (req, res) => {
  // Throw errors directly - no try/catch needed
  throw new BusinessLogicError(
    ErrorCode.CUSTOMER_NOT_FOUND,
    'Customer not found'
  );
}));
```

### 2. WhatsApp Message Handlers
- **Pattern**: Use `handleWhatsAppError` utility for WhatsApp-specific errors
- **Handler**: Errors are logged and optionally sent to user
- **Example**:
```typescript
try {
  // WhatsApp message processing
} catch (error) {
  await handleWhatsAppError(error, whatsappNumber, {
    operation: 'process_message'
  });
}
```

## Service Layer Patterns

### Pattern 1: Services That Throw Errors (Recommended)
Most services should throw custom errors on failure:

```typescript
// CustomerService - throws errors
static async updateCustomer(id: string, data: any): Promise<Customer> {
  try {
    return await prisma.customer.update({ where: { id }, data });
  } catch (error) {
    throw new BusinessLogicError(
      ErrorCode.DATABASE_ERROR,
      'Failed to update customer',
      { metadata: { customerId: id } }
    );
  }
}
```

### Pattern 2: Services With Silent Fallback (Special Cases)
Some services use silent fallback for resilience:

#### RedisService
- **Decision**: Keep fallback pattern for cache operations
- **Reason**: Redis is optional; app should work without it
- **Pattern**: Returns `false` or `null` on failure
```typescript
async get(key: string): Promise<string | null> {
  if (!this.isAvailable()) return null;
  try {
    return await this.client.get(key);
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null; // Silent fallback
  }
}
```

#### OTPService
- **Decision**: Keep fallback to memory when Redis unavailable
- **Reason**: Critical security feature must always work
- **Pattern**: Falls back to memory store if Redis fails

#### RestaurantService
- **Decision**: Returns default config on database errors
- **Reason**: Restaurant must always have configuration
- **Pattern**: Returns sensible defaults instead of throwing

### Pattern 3: WhatsApp Communication Services
Services that send WhatsApp messages return `boolean` for success:

```typescript
// WhatsAppService
static async sendMessage(to: string, message: string): Promise<{ 
  success: boolean; 
  messageId?: string; 
  error?: string 
}> {
  try {
    // Send message
    return { success: true, messageId: response.data.messages[0].id };
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    return { success: false, error: error.message };
  }
}
```

## Custom Error Types

All custom errors extend `BaseError` and include:
- `code`: Unique error code (e.g., 'BL001')
- `type`: Error category (BUSINESS_LOGIC, VALIDATION, etc.)
- `message`: Human-readable message
- `context`: Optional metadata

## Error Codes

Error codes follow a pattern: `[PREFIX][NUMBER]`
- `BL`: Business Logic (e.g., BL001 - ORDER_NOT_FOUND)
- `VAL`: Validation (e.g., VAL001 - INVALID_PRODUCT)
- `TECH`: Technical (e.g., TECH001 - DATABASE_ERROR)
- `EXT`: External Service (e.g., EXT001 - STRIPE_ERROR)
- `RL`: Rate Limit (e.g., RL001 - RATE_LIMIT_EXCEEDED)
- `NF`: Not Found (e.g., NF001 - ADDRESS_NOT_FOUND)

## Migration Notes

### Deprecated Patterns
1. **ErrorService.handleError()** - Use direct error throwing
2. **ErrorService.sendErrorToUser()** - Use `handleWhatsAppError`
3. **Try-catch in routes** - Use `asyncHandler` wrapper
4. **Returning error responses** - Throw errors instead
5. **Manual try-catch in WhatsApp handlers** - Use `wrapWhatsAppHandler`

### New Patterns
1. **Throw errors in services** - Let middleware handle them
2. **Use asyncHandler** - Automatic error catching in routes
3. **handleWhatsAppError** - Centralized WhatsApp error handling
4. **Custom error types** - Semantic error information
5. **wrapWhatsAppHandler** - Wrapper for WhatsApp message handlers

### Recent Updates (January 2025)
- Refactored `cancellationHandler` to use `wrapWhatsAppHandler`
- Removed redundant try-catch from `AudioOrderController`
- Added `WEBHOOK_VERIFICATION_FAILED` error code
- Confirmed `INVALID_TOKEN` error message is user-friendly
- Simplified `StripeService.handleCompletedCheckout` - removed try-catch wrapper
- Simplified `PreOrderWorkflowService.processAction` - removed redundant try-catch
- Simplified all internal handlers in `interactiveMessageHandler.ts`:
  - `handleOnlinePayment`
  - `sendMenu`
  - `handleWaitTimes`
  - `handleRestaurantInfo`
  - `handleChatbotHelp`
  - `handleAddressConfirmation`
  - `handleAddressSelection`
  - `handleAddNewAddress`
  - `handlePreOrderAction`

## Decision Matrix

When to throw errors vs return null/false:

| Scenario | Approach | Example |
|----------|----------|---------|
| Database operation failed | Throw error | CustomerService |
| Optional cache miss | Return null | RedisService |
| Configuration not found | Return defaults | RestaurantService |
| External API failed | Throw error | StripeService |
| Message send failed | Return success flag | WhatsAppService |
| Security operation | Fallback + log | OTPService |

## Best Practices

1. **Always log errors** before throwing or handling
2. **Include context** in error metadata
3. **Use appropriate error codes** from the enum
4. **Let errors bubble up** to the appropriate handler
5. **Don't catch errors** unless you can handle them meaningfully
6. **Prefer throwing** over returning error states
7. **Document exceptions** when not throwing (like Redis fallback)

## Testing Error Scenarios

```typescript
// Test error handling
it('should throw BusinessLogicError when customer not found', async () => {
  await expect(
    CustomerService.updateCustomer('invalid-id', {})
  ).rejects.toThrow(BusinessLogicError);
});
```