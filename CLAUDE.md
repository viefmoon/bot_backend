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
cd backend && npm run dev    # Backend only (port 3001)
cd frontend-app && npm run dev   # Frontend only (port 3000)

# Other development scripts
./dev.sh             # Full dev with hot-reload
./dev-backend.sh     # Backend only development
./dev-frontend.sh    # Frontend only development
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

### Testing WhatsApp Locally
```bash
# 1. Start the backend
./start-local.sh

# 2. In another terminal, expose webhook with ngrok
ngrok http 3001

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
   - Uses semantic similarity matching
   - Executes `map_order_items` function
   - Creates structured order data from conversational input

**AI Service Organization**:
- `AgentService`: Main agent coordinator (170 lines, refactored from 440+)
- `MenuSearchService`: Semantic search with Google embeddings and pgvector
  - Uses text-embedding-004 model (768 dimensions)
  - Uses pgvector for semantic similarity search in all environments
  - Returns empty array if no embeddings found
- `/prompts/`: Externalized AI prompts
  - `generalAgent.prompt.ts`: General agent instructions
  - `orderAgent.prompt.ts`: Order processing instructions
- `/tools/`: Externalized tool definitions
  - `generalAgent.tools.ts`: General agent function tools
  - `orderAgent.tools.ts`: Order agent function tools
- **Semantic Search Setup**:
  - Run `npm run seed:embeddings` to generate embeddings for all products
  - Production: Enable pgvector extension in PostgreSQL
  - Development: Uses JSONB field for local testing
  - Important: Embeddings must be generated before search will work

### Service Architecture

**Stateless Services Pattern**: All services use static methods
- Import `prisma` from server.ts for database access
- Services organized by domain in `/backend/src/services/[domain]/`
- Examples:
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
- Eliminates redundant database calls for configuration data
- Configuration loaded once in `server.ts` during startup
- Auto-reloads in background when cache expires
- All predefined messages now accept configuration as parameter
- Example usage:
  ```typescript
  const config = ConfigService.getConfig(); // Auto-reloads if expired
  const message = BANNED_USER_MESSAGE(config);
  ```
- Cache monitoring:
  ```typescript
  const status = ConfigService.getCacheStatus();
  // Returns: { isLoaded, lastUpdated, ageInSeconds, isExpired, ttlSeconds }
  ```

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

4. **Security**:
   - OTP-based authentication for sensitive operations
   - Centralized OTP middleware (`/backend/src/common/middlewares/otp.middleware.ts`)
   - Message deduplication prevents replay attacks
   - WhatsApp phone number as primary identifier

### Error Handling

**Global Error Handler Middleware**: All Express routes now use a centralized error handling system:

1. **Error Handler Middleware** (`/backend/src/common/middlewares/errorHandler.ts`):
   - Consistent error response format across all APIs
   - Automatic HTTP status code mapping
   - Request ID tracking for debugging
   - Environment-aware error details (more info in development)
   - Special handling for Prisma database errors

2. **Usage Pattern**:
   ```typescript
   // Routes use asyncHandler wrapper
   router.post('/route', asyncHandler(async (req, res) => {
     // Throw custom errors - no try/catch needed
     throw new BusinessLogicError(
       ErrorCode.CUSTOMER_NOT_FOUND,
       'Customer not found',
       { customerId: data.customerId }
     );
   }));
   ```

3. **Error Response Format**:
   ```json
   {
     "error": {
       "code": "BL001",
       "message": "User-friendly error message",
       "type": "BUSINESS_LOGIC",
       "timestamp": "2025-01-20T10:30:00.000Z",
       "requestId": "req_1234567890_abc123",
       "details": {} // Only in development
     }
   }
   ```

4. **Status Code Mapping**:
   - `ValidationError` → 400 Bad Request
   - `NotFoundError` → 404 Not Found
   - `BusinessLogicError` → 409 Conflict
   - `RateLimitError` → 429 Too Many Requests
   - `ExternalServiceError` → 502 Bad Gateway
   - `TechnicalError` → 500 Internal Server Error

### Authentication Middleware

**OTP Authentication Middleware** (`/backend/src/common/middlewares/otp.middleware.ts`):
- Centralizes OTP verification logic across all protected routes
- Automatically validates OTP and attaches customer data to requests
- Supports OTP in request body (POST/PUT/DELETE) or query params (GET)
- Provides `AuthenticatedRequest` interface with customer data

Usage:
```typescript
router.post('/protected-route',
  validationMiddleware(YourDto),
  otpAuthMiddleware, // Handles OTP verification
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const customer = req.customer; // Already validated
    // Your business logic here
  })
);
```

### Type System

- Centralized types in `/backend/src/common/types/`
- Always import from the central index.ts
- Never import directly from Prisma client
- Moving towards unified response types

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
- `RATE_LIMIT_MAX_MESSAGES`: Message limit per window (default: 30)
- `RATE_LIMIT_TIME_WINDOW_MINUTES`: Time window for rate limiting (default: 5)

## Database Schema

### Core Business Models

**Customer** - WhatsApp users
- `id`: UUID primary key
- `whatsappPhoneNumber`: Unique WhatsApp identifier (used for all messaging)
- `firstName/lastName`: Optional customer name
- `email`: Optional email
- `fullChatHistory/relevantChatHistory`: JSON fields storing conversation history
- `stripeCustomerId`: For payment processing
- `isBanned/banReason`: For blocking abusive users
- `totalOrders/totalSpent`: Customer metrics
- Relations: has many `addresses` and `orders`

**Address** - Customer delivery addresses (1:N with Customer)
- `id`: UUID primary key
- `customerId`: Foreign key to Customer
- `street/number/interiorNumber`: Address components
- `neighborhood/city/state/zipCode/country`: Location details
- `latitude/longitude`: GPS coordinates (Decimal precision)
- `references`: Additional delivery instructions
- `isDefault`: Marks primary address

**Order** - Confirmed customer orders
- `id`: UUID primary key
- `dailyNumber`: Sequential number reset daily
- `orderType`: DINE_IN, TAKE_AWAY, or DELIVERY
- `orderStatus`: PENDING → IN_PROGRESS → IN_PREPARATION → READY → IN_DELIVERY → DELIVERED/COMPLETED/CANCELLED
- `paymentStatus`: PENDING or PAID
- `totalCost`: Order total
- `customerId`: Foreign key to Customer
- `scheduledAt`: For future orders
- `messageId`: WhatsApp message tracking
- `stripeSessionId`: Payment tracking
- Relations: has many `orderItems`, has one `deliveryInfo`

**PreOrder** - Temporary orders before confirmation
- `id`: Auto-increment integer
- `orderItems`: JSON containing order details
- `orderType`: Same as Order
- `whatsappPhoneNumber`: Customer phone (not UUID)
- `messageId`: For tracking confirmation buttons
- Relations: can have `deliveryInfo`

**OrderDeliveryInfo** - Snapshot of delivery address at order time
- Preserves historical delivery data
- Contains all address fields (street, number, city, etc.)
- `pickupName`: For TAKE_AWAY orders
- Can belong to either `Order` or `PreOrder`

### Product Catalog Models

**Category** - Top-level product categories
- `id`: String primary key
- `name`: Unique category name
- `photoId`: Optional image reference
- Relations: has many `subcategories`

**Subcategory** - Product subcategories
- Belongs to a `Category`
- Relations: has many `products`

**Product** - Menu items
- `id`: String primary key
- `name/description`: Product details
- `price`: Base price (nullable if has variants)
- `hasVariants`: Boolean flag
- `isPizza`: Special handling for pizzas
- `estimatedPrepTime`: Minutes to prepare
- Relations: has many `variants`, `modifierGroups`, `pizzaIngredients`

**ProductVariant** - Size/type variations (e.g., small, medium, large)
- `price`: Variant-specific price
- Belongs to a `Product`

**ModifierGroup** - Groups of optional modifications
- `minSelections/maxSelections`: Selection constraints
- `isRequired`: Must select at least min
- `allowMultipleSelections`: Can select multiple modifiers
- Relations: has many `productModifiers`

**ProductModifier** - Individual modifications (e.g., extra cheese, no onions)
- `price`: Additional cost (nullable)
- `isDefault`: Pre-selected option
- Belongs to a `ModifierGroup`

**PizzaIngredient** - Special ingredients for pizzas
- `ingredientValue`: Quantity/portion
- `productIds`: Array of applicable pizza products
- Can be added/removed per pizza half

### Order Detail Models

**OrderItem** - Individual items within an order
- Links to `Product` and optionally `ProductVariant`
- `basePrice/finalPrice`: Pricing before/after modifiers
- `preparationStatus`: Independent tracking per item
- Relations: many-to-many with `productModifiers` and `selectedPizzaIngredients`

**SelectedPizzaIngredient** - Pizza customizations per order item
- `half`: LEFT, RIGHT, or FULL pizza
- `action`: ADD or REMOVE ingredient
- Links `OrderItem` to `PizzaIngredient`

### Restaurant Configuration Models

**RestaurantConfig** - Global restaurant settings
- Restaurant name, phones, address
- `acceptingOrders`: Master on/off switch
- `estimatedPickupTime/estimatedDeliveryTime`: Default wait times
- `openingGracePeriod/closingGracePeriod`: Buffer times
- `deliveryCoverageArea`: JSON polygon for delivery zone
- Relations: has many `businessHours`

**BusinessHours** - Operating hours per day
- `dayOfWeek`: 0-6 (Sunday-Saturday)
- `openingTime/closingTime`: HH:mm format
- `isClosed`: Override for holidays

### System Models

**MessageLog** - WhatsApp message deduplication
- `messageId`: Unique WhatsApp message ID
- `processed`: Boolean flag to prevent reprocessing

**MessageRateLimit** - Rate limiting per customer
- `whatsappPhoneNumber`: Customer identifier
- `messageCount`: Messages in current window
- `lastMessageTime`: For sliding window calculation

**SyncLog** - Tracks sync between local and cloud systems
- `entityType/entityId`: What was synced
- `syncDirection`: local_to_cloud or cloud_to_local
- `syncStatus`: pending, success, or failed

**SeederControl** - Prevents duplicate seed runs
- `lastRun`: Timestamp of last seed execution

## Deployment

Railway deployment:
```bash
# Build command
cd backend && npm install && npm run build

# Start command  
cd backend && npm run migrate && npm run seed && npm start
```

Auto-deploys on push to connected repository.

### Semantic Search
- pgvector is configured automatically in both local and production
- Embeddings are generated automatically on server startup if needed
- Updates happen automatically when products change
- Production: Execute `backend/scripts/production-pgvector-setup.sql` if pgvector extension is not available

## Frontend Integration

- React app at `/frontend-app` for address collection
- OTP-secured registration flow
- Google Maps integration for address selection
- Communicates with backend via REST API