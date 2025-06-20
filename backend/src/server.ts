import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook';
import syncRoutes from './routes/sync';
import addressRegistrationRoutes from './routes/address-registration';
import addressSelectionRoutes from './routes/address-selection';
import logger from './common/utils/logger';
import { OTPService } from './services/security/OTPService';
import { PreOrderService } from './services/orders/PreOrderService';
import { WhatsAppService } from './services/whatsapp';
import { DeliveryInfoService } from './services/orders/services/DeliveryInfoService';
import { envValidator, env } from './common/config/envValidator';
import { globalErrorHandler, asyncHandler } from './common/middlewares/errorHandler';
import { validationMiddleware, queryValidationMiddleware } from './common/middlewares/validation.middleware';
import { VerifyOtpDto, InvalidateOtpDto } from './dto/otp';
import { CreateCustomerAddressDto, GetAddressesQueryDto, UpdateAddressDto } from './dto/address';
import { SendMessageDto } from './dto/whatsapp';
import { CreateOrderDto } from './services/orders/dto/create-order.dto';

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

// OTP endpoints
app.post('/backend/otp/verify',
  validationMiddleware(VerifyOtpDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { whatsappPhoneNumber, otp } = req.body as VerifyOtpDto;
    const isValid = await OTPService.verifyOTP(whatsappPhoneNumber, otp);
    res.json({ valid: isValid });
  }));

app.post('/backend/otp/invalidate',
  validationMiddleware(InvalidateOtpDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { whatsappPhoneNumber } = req.body as InvalidateOtpDto;
    await OTPService.invalidateOTP(whatsappPhoneNumber);
    res.json({ success: true });
  }));

// Customer addresses endpoints
app.post('/backend/customer/:customerId/addresses',
  validationMiddleware(CreateCustomerAddressDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const addressData = {
      ...req.body as CreateCustomerAddressDto,
      customer: { connect: { id: customerId } }
    };
  const address = await DeliveryInfoService.createCustomerAddress(addressData);
  res.json(address);
}));

app.get('/backend/customer/:customerId/addresses',
  queryValidationMiddleware(GetAddressesQueryDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const { includeInactive } = req.query as unknown as GetAddressesQueryDto;
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

app.put('/backend/addresses/:addressId',
  validationMiddleware(UpdateAddressDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const address = await DeliveryInfoService.updateCustomerAddress(
      addressId,
      req.body as UpdateAddressDto
    );
  res.json(address);
}));

app.put('/backend/addresses/:addressId/set-default',
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    
    // Get the address to find the customerId
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId },
      select: { customerId: true }
    });
    
    if (!existingAddress) {
      const { NotFoundError, ErrorCode } = await import('./common/services/errors');
      throw new NotFoundError(
        ErrorCode.ADDRESS_NOT_FOUND,
        'Address not found',
        { addressId }
      );
    }
    
    const address = await DeliveryInfoService.setDefaultAddress(addressId, existingAddress.customerId);
    res.json(address);
  }));

app.delete('/backend/addresses/:addressId',
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    
    // Get the address to find the customerId
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId },
      select: { customerId: true }
    });
    
    if (!existingAddress) {
      const { NotFoundError, ErrorCode } = await import('./common/services/errors');
      throw new NotFoundError(
        ErrorCode.ADDRESS_NOT_FOUND,
        'Address not found',
        { addressId }
      );
    }
    
    await DeliveryInfoService.deleteCustomerAddress(addressId, existingAddress.customerId);
    res.json({ success: true });
  }));

// Pre-orders endpoint
app.post('/backend/pre-orders/create',
  validationMiddleware(CreateOrderDto),
  asyncHandler(async (req: Request, res: Response) => {
    const preOrderService = new PreOrderService();
    const result = await preOrderService.createPreOrder(req.body as CreateOrderDto);
  res.status(200).json(result);
}));

// WhatsApp send message endpoint
app.post('/backend/whatsapp/send-message',
  validationMiddleware(SendMessageDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { to, message } = req.body as SendMessageDto;
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