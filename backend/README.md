# Backend - WhatsApp Restaurant Bot

Backend service for a WhatsApp restaurant bot using Express, Prisma, and PostgreSQL.

## Quick Start

See the main README.md in the parent directory for setup instructions.

## Environment Variables

Copy `.env.local` to `.env` and update with your credentials:

```bash
cp .env.local .env
```

## Database Schema

The database uses Prisma ORM with the following main tables:
- Customer: WhatsApp customer information
- Product: Restaurant menu items
- Order: Customer orders
- PreOrder: Temporary cart items
- CustomerDeliveryInfo: Delivery addresses

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