# Backend - WhatsApp Restaurant Bot

Backend service for a WhatsApp restaurant bot using Express, Prisma, and PostgreSQL.

## Quick Start

See the main README.md in the parent directory for setup instructions.

## Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/bot_db

# Google AI
GOOGLE_AI_API_KEY=your_api_key  # Get from https://makersuite.google.com/app/apikey
GEMINI_MODEL=gemini-2.5-pro

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_MESSAGING_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Application
FRONTEND_BASE_URL=http://localhost:3000
NODE_ENV=development
PORT=5000

# Rate Limiting
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_TIME_WINDOW_MINUTES=5

# Optional - Stripe Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Database Schema

The database uses Prisma ORM with the following main tables:
- Customer: WhatsApp customer information
- Product: Restaurant menu items
- Order: Customer orders
- PreOrder: Temporary cart items
- Address: Customer addresses

## API Endpoints

- `GET /backend` - Health check
- `POST /backend/webhook` - WhatsApp webhook
- `POST /backend/otp/verify` - Verify OTP
- `POST /backend/customer-delivery-info` - Create delivery info
- `PUT /backend/customer-delivery-info/:customerId` - Update delivery info
- `GET /backend/customer-delivery-info/:customerId` - Get delivery info
- `POST /backend/pre-orders/select-products` - Add products to cart

## Development

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run studio      # Open Prisma Studio
npm run migrate:dev # Run migrations
npm run seed        # Seed database
```