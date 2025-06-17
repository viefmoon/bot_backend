# Service Architecture Standards

## Overview
This document defines the standard architecture for all services in the backend application.

## Service Patterns

### 1. Stateless Services (Recommended Default)
Use **static class methods** for services that don't maintain state between calls.

```typescript
export class DomainService {
  static async performAction(params: ActionParams): Promise<Result> {
    // Implementation
  }
}
```

### 2. Stateful Services
Use **class instances** only when the service needs to maintain state or configuration.

```typescript
export class ConfigurableService {
  private config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  async performAction(params: ActionParams): Promise<Result> {
    // Use this.config
  }
}
```

### 3. Singleton Services
For services that need global state (e.g., caching), use a singleton pattern.

```typescript
export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, any>;

  private constructor() {
    this.cache = new Map();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  get(key: string): any {
    return this.cache.get(key);
  }
}
```

## Naming Conventions

1. **File Names**: `[Domain]Service.ts` (PascalCase)
   - ✅ `OrderService.ts`
   - ✅ `CustomerService.ts`
   - ❌ `customers.ts`
   - ❌ `order-service.ts`

2. **Class Names**: `[Domain]Service` (PascalCase)
   - ✅ `OrderService`
   - ✅ `CustomerService`

3. **Method Names**: camelCase, descriptive verbs
   - ✅ `createOrder()`
   - ✅ `validateCustomer()`
   - ❌ `order()`
   - ❌ `validate()`

## Directory Structure

```
src/
├── services/
│   ├── ai/                    # AI-related services
│   │   ├── AgentService.ts
│   │   └── GeminiService.ts
│   ├── communication/         # External communication
│   │   ├── WhatsAppService.ts
│   │   └── EmailService.ts
│   ├── customer/              # Customer domain
│   │   └── CustomerService.ts
│   ├── messaging/             # Internal message processing
│   │   └── MessagePipeline.ts
│   ├── order/                 # Order domain
│   │   ├── OrderService.ts
│   │   ├── PreOrderService.ts
│   │   └── MenuService.ts
│   ├── payment/               # Payment processing
│   │   └── StripeService.ts
│   ├── restaurant/            # Restaurant configuration
│   │   └── RestaurantService.ts
│   └── security/              # Security services
│       └── OTPService.ts
```

## Service Responsibilities

Each service should:
1. Handle a single domain/responsibility
2. Expose a clear public API
3. Hide implementation details
4. Use dependency injection where appropriate
5. Return consistent response types
6. Handle errors appropriately (throw custom errors)

## Dependencies

### Database Access
- Services should import `prisma` from the server file
- Consider creating a repository layer for complex queries

### Other Services
- Import services directly, don't create circular dependencies
- Use interfaces for loose coupling when needed

### External APIs
- Wrap all external API calls in service methods
- Handle API-specific errors and convert to domain errors

## Error Handling

Services should:
1. Use the centralized error service
2. Throw domain-specific errors
3. Let handlers decide how to respond to users

```typescript
import { BusinessLogicError, ErrorCode } from '@/common/services/errors';

export class OrderService {
  static async createOrder(data: CreateOrderDto): Promise<Order> {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId: data.customerId }
      );
    }

    // Continue with order creation
  }
}
```

## Migration Checklist

When refactoring existing services:
- [ ] Convert to class with static methods (if stateless)
- [ ] Use PascalCase for file and class names
- [ ] Move to appropriate domain directory
- [ ] Add proper TypeScript types
- [ ] Implement error handling with custom errors
- [ ] Add JSDoc documentation
- [ ] Update all imports