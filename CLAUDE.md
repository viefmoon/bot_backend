# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## First Time Setup

**IMPORTANT**: Before running the development scripts for the first time, you need to set up the database:

```bash
# 1. Start Docker containers
docker compose up -d

# 2. Wait a few seconds for PostgreSQL to be ready

# 3. Run database migrations (creates all tables)
cd backend && npm run migrate:dev

# 4. Now you can run the development script
start-dev.bat       # Windows
./start-dev.sh      # Linux/Mac
```

## Commands

### Development
```bash
# Start everything (Docker + Backend API + Worker + Frontend)
./start-dev.sh      # Linux/Mac
start-dev.bat       # Windows

# This script:
# - Cleans up ports and Docker containers
# - Starts PostgreSQL and Redis via Docker
# - Installs dependencies if needed
# - Runs database migrations (ONLY if migrations already exist)
# - Starts Backend API (port 5000)
# - Starts BullMQ Worker for async processing
# - Starts Frontend (port 3000) if present

# Clean up stuck ports manually if needed
./cleanup-ports.sh

# Or run services manually:
cd backend && npm run dev         # Terminal 1: API Server
cd backend && npm run dev:worker  # Terminal 2: Message Worker
cd frontend-app && npm run dev    # Terminal 3: Frontend (optional)
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

**Important Notes about Migrations**:
- Migrations are NOT automatic - you must run them manually
- First time setup: Always run `npm run migrate:dev` to create initial tables
- After schema changes: Run `npm run migrate:dev` to update database structure
- The `start-dev.bat` script runs `migrate deploy` which only applies existing migrations, it does NOT create new ones

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

### Production PM2 - Update Environment Variables
**Important**: `pm2 reload` does NOT update environment variables from .env file. You must restart:
```bash
# Edit .env file
cd backend && nano .env

# Option 1: Delete and start fresh (recommended)
pm2 delete all
pm2 start ecosystem.config.js

# Option 2: Stop and start
pm2 stop all
pm2 start ecosystem.config.js

# Verify the change
pm2 env 0 | grep YOUR_VARIABLE_NAME
```

## Architecture Overview

This is a WhatsApp restaurant ordering bot with AI-powered natural language processing.

### Message Processing Pipeline

WhatsApp messages now flow through an asynchronous queue-based system using BullMQ:

```
Webhook Entry (/backend/webhook)
    ↓
WhatsAppService.handleWebhook()
    ↓
Enqueue message to BullMQ (immediate 200 OK response)
    ↓
BullMQ Worker (separate process)
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

**Key Benefits of Async Processing**:
- Webhook responds immediately (prevents WhatsApp timeouts)
- Messages from same user processed sequentially (prevents race conditions)
- Messages from different users processed in parallel
- Automatic retry on failures with exponential backoff
- Scalable: can run multiple worker processes

**Sequential Processing Implementation**:
- Uses Redis-based distributed locking to ensure messages from the same user are processed one at a time
- Works correctly with multiple worker processes (PM2 cluster mode)
- Lock automatically expires after 5 minutes to prevent permanent blocks
- Exponential backoff when waiting for locks

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
   - Shows summary with confirm/discard buttons
   - Confirmation converts PreOrder to Order
   - Shift order numbers assigned during sync (not at creation)

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

### Production with PM2

The recommended way to run in production is using PM2 for process management:

```bash
# Install PM2 globally
npm install pm2 -g

# Configure workers via .env
BULLMQ_WORKER_CONCURRENCY=10  # Jobs per worker process
NUM_WORKERS=4                  # Number of worker processes

# Start all services with PM2
cd backend && npm run pm2:start

# Other PM2 commands
npm run pm2:stop      # Stop all services
npm run pm2:reload    # Reload with zero downtime
npm run pm2:logs      # View logs
npm run pm2:monit     # Monitor processes
```

**Scaling Strategy**:
- `BULLMQ_WORKER_CONCURRENCY`: Controls concurrent jobs per worker (I/O bound tasks)
- `NUM_WORKERS`: Controls number of worker processes (CPU bound scaling)
- Total capacity = NUM_WORKERS × BULLMQ_WORKER_CONCURRENCY
- **Important**: The implementation uses Redis-based distributed locking to ensure sequential processing per user across all worker processes

For manual deployment:
- Deploy API server and worker as separate services
- Both share same Redis instance for BullMQ
- Set concurrency in worker based on available resources

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