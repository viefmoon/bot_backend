import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook';
import syncRoutes from './routes/sync';
import addressRegistrationRoutes from './routes/address-registration';
import logger from './common/utils/logger';
import { OTPService } from './services/security/OTPService';
import { PreOrderService } from './services/orders/PreOrderService';
import { WhatsAppService } from './services/whatsapp';
import { DeliveryInfoService } from './services/orders/services/DeliveryInfoService';
import { envValidator, env } from './common/config/envValidator';

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

// OTP endpoints
app.post('/backend/otp/verify', async (req, res) => {
  try {
    const { customerId, otp } = req.body;
    const isValid = await OTPService.verifyOTP(customerId, otp);
    res.json({ valid: isValid });
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/backend/otp/invalidate', async (req, res) => {
  try {
    const { customerId } = req.body;
    await OTPService.invalidateOTP(customerId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error invalidating OTP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer addresses endpoints
app.post('/backend/customer/:customerId/addresses', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const addressData = {
      ...req.body,
      customer: { connect: { customerId } }
    };
    const address = await DeliveryInfoService.createCustomerAddress(addressData);
    res.json(address);
  } catch (error: any) {
    logger.error('Error creating address:', error);
    if (error.code) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/backend/customer/:customerId/addresses', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const includeInactive = req.query.includeInactive === 'true';
    const addresses = await DeliveryInfoService.getCustomerAddresses(customerId, includeInactive);
    res.json(addresses);
  } catch (error: any) {
    logger.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/backend/customer/:customerId/addresses/default', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const address = await DeliveryInfoService.getCustomerDefaultAddress(customerId);
    if (!address) {
      res.status(404).json({ error: 'No default address found' });
    } else {
      res.json(address);
    }
  } catch (error: any) {
    logger.error('Error fetching default address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/backend/addresses/:addressId', async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;
    const address = await DeliveryInfoService.updateCustomerAddress(
      parseInt(addressId),
      req.body
    );
    res.json(address);
  } catch (error: any) {
    logger.error('Error updating address:', error);
    if (error.code === 'CUSTOMER_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.code) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.put('/backend/addresses/:addressId/set-default', async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;
    const { customerId } = req.body;
    const address = await DeliveryInfoService.setDefaultAddress(parseInt(addressId), customerId);
    res.json(address);
  } catch (error: any) {
    logger.error('Error setting default address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/backend/addresses/:addressId', async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;
    const { customerId } = req.body;
    await DeliveryInfoService.deleteCustomerAddress(parseInt(addressId), customerId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting address:', error);
    if (error.code === 'ORDER_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Pre-orders endpoint
app.post('/backend/pre-orders/select-products', async (req: Request, res: Response) => {
  try {
    const preOrderService = new PreOrderService();
    const result = await preOrderService.selectProducts(req.body);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error creating pre-order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WhatsApp send message endpoint
app.post('/backend/whatsapp/send-message', async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await WhatsAppService.sendMessage(to, message);
    res.json(result);
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

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