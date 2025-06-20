# Global Error Handler Implementation

## Overview

A centralized error handling middleware has been implemented to standardize error responses across the API and simplify error handling in route handlers.

## Key Components

### 1. Error Handler Middleware (`/src/common/middlewares/errorHandler.ts`)

The global error handler provides:
- Consistent error response format
- Proper HTTP status code mapping
- Request ID tracking
- Environment-aware error details
- Automatic logging based on error severity
- Prisma error handling

### 2. Async Handler Wrapper

The `asyncHandler` function wraps async route handlers to automatically catch errors and pass them to the error middleware:

```typescript
router.get('/route', asyncHandler(async (req, res) => {
  // Your async code here
  // Any thrown errors are automatically caught
}));
```

### 3. Error Response Format

All errors now return a consistent JSON structure:

```json
{
  "error": {
    "code": "BL001",
    "message": "User-friendly error message",
    "type": "BUSINESS_LOGIC",
    "timestamp": "2025-01-20T10:30:00.000Z",
    "requestId": "req_1234567890_abc123",
    "details": {} // Only in development mode
  }
}
```

## Status Code Mapping

- `ValidationError` → 400 Bad Request
- `NotFoundError` → 404 Not Found  
- `BusinessLogicError` → 409 Conflict
- `RateLimitError` → 429 Too Many Requests
- `ExternalServiceError` → 502 Bad Gateway
- `TechnicalError` → 500 Internal Server Error

## Migration Guide

### Before (Old Pattern)

```typescript
router.post('/route', async (req, res) => {
  try {
    // ... business logic
    res.json({ data });
  } catch (error: any) {
    logger.error('Error description:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### After (New Pattern)

```typescript
router.post('/route', asyncHandler(async (req, res) => {
  // ... business logic
  // Throw appropriate errors when needed:
  if (!data) {
    throw new NotFoundError(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Resource not found',
      { resourceId: id }
    );
  }
  res.json({ data });
}));
```

## Benefits

1. **DRY Principle**: Eliminates repetitive try-catch blocks
2. **Consistency**: All errors follow the same response format
3. **Better Logging**: Centralized logging with proper severity levels
4. **Security**: Production mode hides sensitive error details
5. **Debugging**: Request IDs help trace errors across logs
6. **Maintainability**: Change error format in one place

## Testing

Test endpoints are available at `/backend/test-errors/*`:
- `/test-validation-error` - Returns 400
- `/test-not-found-error` - Returns 404
- `/test-business-error` - Returns 409
- `/test-success` - Returns 200
- `/test-unhandled-error` - Returns 500

## Next Steps

1. Remove all try-catch blocks from remaining routes
2. Update all routes to use `asyncHandler`
3. Ensure all services throw appropriate custom errors
4. Remove test routes before production deployment
5. Consider adding error monitoring/alerting integration