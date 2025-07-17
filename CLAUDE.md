# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start local development (both backend and frontend)
./start-local.sh

# Clean up ports if they're stuck (e.g., docker-proxy processes)
./cleanup-ports.sh

# Or run separately:
npm run dev          # Runs both backend and frontend concurrently
cd backend && npm run dev    # Backend only (port 5000)
cd frontend-app && npm run dev   # Frontend only (port 3000)
```

### Database Management
```bash
cd backend
npm run generate      # Generate Prisma client after schema changes
npm run migrate:dev   # Create and apply migrations in development
npm run migrate       # Apply migrations in production
npm run studio        # Open Prisma Studio to view/edit database
npm run seed:embeddings  # Generate embeddings for semantic search
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

### Linting & Type Checking
```bash
cd frontend-app && npm run lint    # ESLint for frontend
cd backend && npm run build        # TypeScript compilation checks
```

### Testing WhatsApp Locally
```bash
# 1. Start the backend
./start-local.sh

# 2. In another terminal, expose webhook with ngrok
ngrok http 5000

# 3. Update webhook URL in Meta Business dashboard to:
# https://[your-ngrok-id].ngrok.io/backend/webhook
```

## Architecture Overview

This is a WhatsApp restaurant ordering bot with AI-powered natural language processing.

### Message Processing Pipeline

WhatsApp messages flow through a sophisticated middleware pipeline:

```
Webhook Entry (/backend/webhook)
    ↓
WhatsAppService.handleWebhook()
    ↓
MessageProcessor.processWithPipeline()
    ↓
Middleware Pipeline:
    1. RateLimitMiddleware (configurable limits)
    2. CustomerValidationMiddleware (creates/validates customers, loads chat history)
    3. RestaurantHoursMiddleware (checks if restaurant is open)
    4. AddressRequiredMiddleware (blocks until address registered)
    5. MessageTypeMiddleware (routes to appropriate strategy)
    6. MessageProcessingMiddleware (strategy pattern):
        - AudioMessageStrategy (transcribes with Gemini)
        - InteractiveMessageStrategy (button/list responses)
        - TextMessageStrategy (AI agent processing)
```

### AI Agent Architecture

**Two-Agent System**:

1. **General Agent** (`AgentService.processMessage`)
   - Detects user intent and routes appropriately
   - Function tools available:
     - `send_menu`: Display full restaurant menu
     - `get_business_hours`: Restaurant info and hours
     - `prepare_order_context`: Initiate order processing
     - `generate_address_update_link`: OTP-secured address update
     - `send_bot_instructions`: Help messages
     - `reset_conversation`: Clear chat history
   - Always asks for order type (delivery/takeaway) before processing

2. **Order Agent** (`AgentService.processOrderMapping`)
   - Specialized for mapping natural language to menu items
   - Uses semantic similarity matching with pgvector
   - Executes `map_order_items` function
   - Creates structured order data from conversational input

**Semantic Search Setup**:
- Run `npm run seed:embeddings` to generate embeddings for all products
- Uses Google's text-embedding-004 model (768 dimensions)
- Production: Enable pgvector extension in PostgreSQL
- Development: Uses JSONB field for local testing
- Important: Embeddings must be generated before search will work

### Service Architecture

**Stateless Services Pattern**: All services use static methods
- Import `prisma` from server.ts for database access
- Services organized by domain in `/backend/src/services/[domain]/`
- Example:
  ```typescript
  export class OrderService {
    static async createOrder(data: CreateOrderData): Promise<Order> {
      // Implementation
    }
  }
  ```

**Configuration Management**:
- `ConfigService`: Loads and caches restaurant configuration with auto-reload
- Cache TTL: 2 minutes (auto-reloads when expired)
- All predefined messages now accept configuration as parameter

### Error Handling Architecture

**Unified Error Handling Approach**:

1. **For HTTP Routes**: Use `asyncHandler` wrapper
   ```typescript
   router.post('/route', asyncHandler(async (req, res) => {
     throw new BusinessLogicError(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
   }));
   ```

2. **For WhatsApp Handlers**: Use `handleWhatsAppError` or `wrapWhatsAppHandler`
   ```typescript
   export const handler = wrapWhatsAppHandler(async (from: string) => {
     // Handler logic - throw errors directly
   }, 'handlerName');
   ```

3. **For AI Tool Handlers**: Throw errors directly, caught by TextProcessingService
   ```typescript
   export const handleTool: ToolHandler = async () => {
     // No try-catch needed - errors propagate up
     const result = await someOperation();
     return { text: result, isRelevant: true };
   };
   ```

**Custom Error Types**:
- `BusinessLogicError` → 409 Conflict
- `ValidationError` → 400 Bad Request
- `TechnicalError` → 500 Internal Server Error
- `ExternalServiceError` → 502 Bad Gateway
- `RateLimitError` → 429 Too Many Requests
- `NotFoundError` → 404 Not Found

**Special Cases with Silent Fallback**:
- `RedisService`: Returns null/false on failure (app works without Redis)
- `OTPService`: Falls back to memory store if Redis unavailable
- `RestaurantService`: Returns default config on database errors

### Key Business Logic

1. **Address Requirement**: Customers MUST have a registered address before any conversation
   - Enforced by `AddressRequiredMiddleware`
   - Generates OTP and sends registration link
   - Blocks all other interactions until completed

2. **Order Flow**:
   - User message → AI extracts items → Creates PreOrder
   - Shows summary with confirm/cancel buttons
   - Confirmation converts PreOrder to Order
   - Generates unique daily order number

3. **Message History Management**:
   - Full history stored for context
   - Relevant history (last 20 messages) for AI processing
   - Automatic cleanup of duplicate consecutive messages
   - History markers for important events (resets, orders)

### Authentication & Security

**OTP Authentication Middleware** (`/backend/src/common/middlewares/otp.middleware.ts`):
```typescript
router.post('/protected-route',
  validationMiddleware(YourDto),
  otpAuthMiddleware, // Handles OTP verification
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const customer = req.customer; // Already validated
  })
);
```

### Type System

- Centralized types in `/backend/src/common/types/`
- DTOs organized by domain in `/backend/src/dto/[domain]/`
- Always import from the domain index.ts
- Never import directly from Prisma client

### Important Implementation Details

1. **Message Splitting**: Automatic splitting at 4000 chars
2. **WhatsApp Message Types**:
   - Text: Processed through AI agents
   - Audio: Transcribed then processed as text
   - Interactive: Direct action handlers (bypasses AI)
3. **Response Accumulation**: Context collects all responses during pipeline
4. **Idempotency**: Message log prevents duplicate processing

## Environment Variables

Required (see `.env.example` for full list):
- `DATABASE_URL`: PostgreSQL connection (local uses port 5433 to avoid conflicts)
- `GOOGLE_AI_API_KEY`: Google AI API key for Gemini
- `GEMINI_MODEL`: Model version (default: gemini-2.5-pro)
- `WHATSAPP_PHONE_NUMBER_MESSAGING_ID`: Meta phone number ID
- `WHATSAPP_ACCESS_TOKEN`: WhatsApp API access token
- `WHATSAPP_VERIFY_TOKEN`: Webhook verification token
- `FRONTEND_BASE_URL`: Frontend URL for address collection
- `CLOUD_API_KEY`: API key for cloud sync operations

## Deployment

Railway deployment:
```bash
# Build command
cd backend && npm install && npm run build

# Start command  
cd backend && npm run migrate && npm start
```

Auto-deploys on push to connected repository.

### Semantic Search in Production
- pgvector is configured automatically in both local and production
- Embeddings are generated automatically on server startup if needed
- Production: Execute `backend/scripts/production-pgvector-setup.sql` if pgvector extension is not available

## Local Development Setup

- **PostgreSQL**: Runs on port 5433 (via Docker)
- **Redis**: Runs on port 6380 (via Docker, optional for OTP/cache)
- **Docker Compose**: Manages local database and cache services
- Backend port is 5000 (not 3001 as sometimes referenced)
- Use `start-local.sh` to ensure Docker containers are running