# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start local development (both backend and frontend)
./start-local.sh

# Or run separately:
npm run dev          # Runs both backend and frontend concurrently
cd backend && npm run dev    # Backend only (port 3001)
cd frontend-app && npm run dev   # Frontend only (port 3000)
```

### Database Management
```bash
cd backend
npm run generate      # Generate Prisma client after schema changes
npm run migrate:dev   # Create and apply migrations in development
npm run migrate       # Apply migrations in production
npm run studio        # Open Prisma Studio to view/edit database
npm run seed          # Seed database with initial restaurant data
```

### Build & Production
```bash
npm run build         # Build both backend and frontend
npm run start         # Build and start both services

# Backend only
cd backend && npm run build && npm run start

# Frontend only  
cd frontend-app && npm run build && npm run preview
```

### Linting
```bash
cd frontend-app && npm run lint    # ESLint for frontend
# Note: No linting configured for backend
```

## Architecture Overview

This is a WhatsApp restaurant ordering bot with the following architecture:

### Backend Architecture

The backend follows a **service-oriented architecture** with these key patterns:

1. **Stateless Services Pattern**: All services use static methods and are organized by domain
   - Services import `prisma` from the server file for database access
   - Each service handles a single domain responsibility
   - Located in `/backend/src/services/[domain]/`

2. **Message Processing Pipeline**: WhatsApp messages flow through a middleware pipeline:
   ```
   RateLimitMiddleware → CustomerValidationMiddleware → MessageTypeMiddleware → Strategy (Text/Audio/Interactive)
   ```

3. **AI Integration**: Uses Google Gemini AI for natural language understanding and order processing
   - AgentService orchestrates AI interactions
   - Supports text and audio transcription

4. **Type System**: Centralized type definitions in `/backend/src/common/types/`
   - All types should be imported from the central index.ts
   - Moving towards unified response types (`UnifiedResponse`)

### Key Services

- **Order Management** (`/services/orders/`): Handles order creation, modification, cancellation
- **AI Services** (`/services/ai/`): Gemini integration and agent orchestration
- **Messaging** (`/services/messaging/`): Message processing pipeline and strategies
- **WhatsApp** (`/services/whatsapp/`): WhatsApp API integration
- **Customer** (`/services/customer/`): Customer management and validation
- **Products** (`/services/products/`): Menu and product management
- **Restaurant** (`/services/restaurant/`): Restaurant configuration and hours

### Frontend Architecture

React app for collecting delivery addresses with Google Maps integration:
- Vite + React + TypeScript
- Tailwind CSS for styling
- React Hook Form for form handling
- Google Maps for address selection

## Development Guidelines

### Service Implementation Rules
```typescript
// Services should follow this pattern:
export class MyService {
  static async myMethod(params: MyParams): Promise<MyResponse> {
    // Implementation
  }
}
```

### Error Handling
```typescript
// Use centralized error service
throw new BusinessLogicError(
  ErrorCode.CUSTOMER_NOT_FOUND,
  'Customer not found',
  { customerId: data.customerId }
);
```

### Type Imports
```typescript
// ✅ Always import from common types
import { Order, OrderType } from '@/common/types';

// ❌ Never import directly from Prisma
import { Order } from '@prisma/client';
```

### WhatsApp Testing
- Use ngrok to expose local webhook: `ngrok http 3001`
- Update webhook URL in Meta Business dashboard
- Test with real WhatsApp messages

## Environment Variables

Required environment variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection (local uses port 5433)
- `GOOGLE_AI_API_KEY`: Google AI API key for Gemini
- `GEMINI_MODEL`: Gemini model version (default: gemini-2.5-pro-preview-05-06)
- `WHATSAPP_*`: WhatsApp Business API credentials
- `FRONTEND_BASE_URL`: Frontend URL for address collection

## Database Schema

Key models in Prisma schema:
- `Customer`: WhatsApp users
- `Order`: Customer orders with status tracking
- `OrderItem`: Individual items in an order
- `Product`: Menu items
- `Category`: Product categories
- `Restaurant`: Restaurant configuration
- `Message`: Message history for context

## Deployment

The project deploys to Railway with:
```bash
# Build command
cd backend && npm install && npm run build

# Start command  
cd backend && npm run migrate && npm run seed && npm start
```

Auto-deploys on push to the connected repository.