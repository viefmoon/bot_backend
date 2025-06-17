# Type Definitions Structure

This directory contains all shared type definitions for the backend application.

## Organization

### Core Types
- `index.ts` - Central export file, import all types from here
- `order.types.ts` - Order-related types (NewOrder, OrderProduct, etc.)
- `menu.ts` - Menu and product types
- `restaurant.ts` - Restaurant configuration types
- `agents.ts` - AI agent types

### Communication Types
- `whatsapp.types.ts` - WhatsApp message types (outgoing)
- `webhook.types.ts` - Webhook and incoming message types
- `responses.ts` - Legacy response types (being migrated to UnifiedResponse)

### Service Types
- `services.types.ts` - Types used across multiple services
- `otp.types.ts` - OTP-related types

### Error Types
Located in `/common/services/errors/types.ts`:
- Error codes and types
- Error context and response types

## Type Naming Conventions

### WhatsApp Messages
- `IncomingWhatsAppMessage` - Messages received via webhook
- `OutgoingWhatsAppMessage` - Messages sent to users
- `OutgoingWhatsAppInteractiveMessage` - Interactive messages sent to users

### Response Types
We're migrating from multiple response types to a unified system:
- ❌ `AIResponse` (legacy)
- ❌ `MessageResponse` (legacy)
- ✅ `UnifiedResponse` (current standard)

### Import Best Practices

Always import types from the central index:
```typescript
// ✅ Good
import { Order, OrderType, DeliveryInfoInput } from '@/common/types';

// ❌ Bad
import { Order } from '@prisma/client';
import { DeliveryInfoInput } from '@/common/types/services.types';
```

## Prisma Types

Common Prisma types are re-exported through `index.ts` for convenience:
- Models: Customer, Order, Product, etc.
- Enums: OrderType, OrderStatus, PaymentStatus, etc.

## Migration Notes

### In Progress
1. Migrating all responses to use `UnifiedResponse`
2. Consolidating duplicate type definitions
3. Moving inline interfaces to `services.types.ts`

### Completed
1. Renamed WhatsApp types to avoid conflicts
2. Created central export file
3. Consolidated service-specific types