import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook';
import syncRoutes from './routes/sync';
import addressRegistrationRoutes from './routes/address-registration';
import addressSelectionRoutes from './routes/address-selection';
import testErrorRoutes from './routes/test-error-handler';
import logger from './common/utils/logger';
import { OTPService } from './services/security/OTPService';
import { PreOrderService } from './services/orders/PreOrderService';
import { WhatsAppService } from './services/whatsapp';
import { DeliveryInfoService } from './services/orders/services/DeliveryInfoService';
import { envValidator, env } from './common/config/envValidator';
import { globalErrorHandler, asyncHandler } from './common/middlewares/errorHandler';

// Validate environment variables
try {
  envValidator.validate();
} catch (error) {
  logger.error('Environment validation failed:', error);
  process.exit(1);
}

// Initialize Express app
const app: express.Application = express();
const prisma = new PrismaClient();

// Configure CORS
app.use(cors({
  origin: [
    'https://pizzatototlan.store',
    'http://localhost:3000',
    env.FRONTEND_BASE_URL
  ].filter(Boolean),
  credentials: true,
}));

// Middleware for parsing JSON (except for webhook route)
app.use((req, res, next) => {
  if (req.path === '/backend/webhook' && req.method === 'POST') {
    // Skip JSON parsing for webhook verification
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Health check endpoint
app.get('/backend', (_, res) => {
  res.json({ 
    message: 'Bot Backend API is running',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/backend/webhook', webhookRoutes);
app.use('/backend/sync', syncRoutes);
app.use('/backend/address-registration', addressRegistrationRoutes);
app.use('/backend/address-selection', addressSelectionRoutes);
app.use('/backend/test-errors', testErrorRoutes); // Remove in production

// OTP endpoints
app.post('/backend/otp/verify', asyncHandler(async (req: Request, res: Response) => {
  const { customerId, otp } = req.body;
  const isValid = await OTPService.verifyOTP(customerId, otp);
  res.json({ valid: isValid });
}));

app.post('/backend/otp/invalidate', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.body;
  await OTPService.invalidateOTP(customerId);
  res.json({ success: true });
}));

// Customer addresses endpoints
app.post('/backend/customer/:customerId/addresses', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const addressData = {
    ...req.body,
    customer: { connect: { customerId } }
  };
  const address = await DeliveryInfoService.createCustomerAddress(addressData);
  res.json(address);
}));

app.get('/backend/customer/:customerId/addresses', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const includeInactive = req.query.includeInactive === 'true';
  const addresses = await DeliveryInfoService.getCustomerAddresses(customerId, includeInactive);
  res.json(addresses);
}));

app.get('/backend/customer/:customerId/addresses/default', asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { NotFoundError, ErrorCode } = await import('./common/services/errors');
  const address = await DeliveryInfoService.getCustomerDefaultAddress(customerId);
  if (!address) {
    throw new NotFoundError(
      ErrorCode.ADDRESS_NOT_FOUND,
      'No default address found',
      { customerId }
    );
  }
  res.json(address);
}));

app.put('/backend/addresses/:addressId', asyncHandler(async (req: Request, res: Response) => {
  const { addressId } = req.params;
  const address = await DeliveryInfoService.updateCustomerAddress(
    addressId,
    req.body
  );
  res.json(address);
}));

app.put('/backend/addresses/:addressId/set-default', asyncHandler(async (req: Request, res: Response) => {
  const { addressId } = req.params;
  const { customerId } = req.body;
  const address = await DeliveryInfoService.setDefaultAddress(addressId, customerId);
  res.json(address);
}));

app.delete('/backend/addresses/:addressId', asyncHandler(async (req: Request, res: Response) => {
  const { addressId } = req.params;
  const { customerId } = req.body;
  await DeliveryInfoService.deleteCustomerAddress(addressId, customerId);
  res.json({ success: true });
}));

// Pre-orders endpoint
app.post('/backend/pre-orders/create', asyncHandler(async (req: Request, res: Response) => {
  const preOrderService = new PreOrderService();
  const result = await preOrderService.createPreOrder(req.body);
  res.status(200).json(result);
}));

// WhatsApp send message endpoint
app.post('/backend/whatsapp/send-message', asyncHandler(async (req: Request, res: Response) => {
  const { to, message } = req.body;
  const result = await WhatsAppService.sendMessage(to, message);
  res.json(result);
}));

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

// Start server
const PORT = parseInt(env.PORT, 10);

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    // Start OTP cleanup interval
    OTPService.startOTPCleanup();
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  OTPService.stopOTPCleanup();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  OTPService.stopOTPCleanup();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export { app, prisma };