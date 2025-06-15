import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from './routes/webhook';
import logger from './utils/logger';
import { verifyOTP, invalidateOTP } from './services/otp';
import { PreOrderService } from './services/preOrder';
import { sendWhatsAppMessage } from './services/whatsapp';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: express.Application = express();
const prisma = new PrismaClient();

// Configure CORS
app.use(cors({
  origin: [
    'https://pizzatototlan.store',
    'http://localhost:3000',
    process.env.FRONTEND_BASE_URL || ''
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

// OTP endpoints
app.post('/backend/otp/verify', async (req, res) => {
  try {
    const { customerId, otp } = req.body;
    const isValid = await verifyOTP(customerId, otp);
    res.json({ valid: isValid });
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/backend/otp/invalidate', async (req, res) => {
  try {
    const { customerId } = req.body;
    await invalidateOTP(customerId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error invalidating OTP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer delivery info endpoints
app.post('/backend/customer-delivery-info', async (req, res) => {
  try {
    const deliveryInfo = await prisma.customerDeliveryInfo.create({
      data: req.body
    });
    res.json(deliveryInfo);
  } catch (error) {
    logger.error('Error creating delivery info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/backend/customer-delivery-info/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const deliveryInfo = await prisma.customerDeliveryInfo.update({
      where: { customerId },
      data: req.body
    });
    res.json(deliveryInfo);
  } catch (error) {
    logger.error('Error updating delivery info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const getCustomerDeliveryInfo = async (req: any, res: any) => {
  try {
    const { customerId } = req.params;
    const deliveryInfo = await prisma.customerDeliveryInfo.findUnique({
      where: { customerId }
    });
    
    if (!deliveryInfo) {
      return res.status(404).json({ error: 'Delivery info not found' });
    }
    
    return res.json(deliveryInfo);
  } catch (error) {
    logger.error('Error fetching delivery info:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

app.get('/backend/customer-delivery-info/:customerId', getCustomerDeliveryInfo);

// Pre-orders endpoint
app.post('/backend/pre-orders/select-products', async (req, res) => {
  try {
    const preOrderService = new PreOrderService();
    const result = await preOrderService.selectProducts(req.body);
    res.status(result.status).json(result.json);
  } catch (error) {
    logger.error('Error creating pre-order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WhatsApp send message endpoint
app.post('/backend/whatsapp/send-message', async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await sendWhatsAppMessage(to, message);
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
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');
    
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
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export { app, prisma };