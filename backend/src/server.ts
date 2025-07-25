import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import webhookRoutes from './routes/webhook';
import syncRoutes from './routes/sync';
import addressRegistrationRoutes from './routes/address-registration';
import logger from './common/utils/logger';
import { OTPService } from './services/security/OTPService';
import { WhatsAppService } from './services/whatsapp';
import { envValidator, env } from './common/config/envValidator';
import { globalErrorHandler, asyncHandler } from './common/middlewares/errorHandler';
import { validationMiddleware } from './common/middlewares/validation.middleware';
import { VerifyOtpDto } from './dto/auth';
import { SendMessageDto } from './dto/whatsapp';
import { ConfigService } from './services/config/ConfigService';
import { prisma } from './lib/prisma';

// Validate environment variables
try {
  envValidator.validate();
} catch (error) {
  logger.error('Environment validation failed:', error);
  process.exit(1);
}

// Initialize Express app
const app: express.Application = express();

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
  if (req.path === '/api/webhook' && req.method === 'POST') {
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
app.use('/api/webhook', webhookRoutes);
app.use('/api/sync', syncRoutes);
app.use('/backend/address-registration', addressRegistrationRoutes);

// Import and use audio routes
import audioOrderRoutes from './api/audio/audioOrder.routes';
app.use('/api/v1/audio', audioOrderRoutes);

// OTP endpoints
app.post('/backend/otp/verify',
  validationMiddleware(VerifyOtpDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { whatsappPhoneNumber, otp } = req.body as VerifyOtpDto;
    const isValid = await OTPService.verifyOTP(whatsappPhoneNumber, otp);
    res.json({ valid: isValid });
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
let preOrderCleanupInterval: NodeJS.Timeout;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Load restaurant configuration
    await ConfigService.loadConfig();
    
    // Connect to Redis
    const { redisService } = await import('./services/redis/RedisService');
    await redisService.connect();
    
    // Start OTP cleanup interval
    OTPService.startOTPCleanup();
    
    // Start PreOrder cleanup interval
    const { PreOrderWorkflowService } = await import('./services/orders/PreOrderWorkflowService');
    preOrderCleanupInterval = setInterval(async () => {
      await PreOrderWorkflowService.cleanupExpiredPreOrders();
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    // Initialize embeddings on startup
    const { initializeEmbeddings } = await import('./startup/embeddingInitializer');
    await initializeEmbeddings();
    
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
    
    // Initialize WebSocket for sync notifications with Redis adapter
    const io = await import('socket.io');
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const IORedis = (await import('ioredis')).default;
    
    // Create pub/sub clients for Socket.IO
    const pubClient = new IORedis({
      host: env.REDIS_HOST || 'localhost',
      port: parseInt(env.REDIS_PORT || '6380', 10),
      password: env.REDIS_PASSWORD,
    });
    const subClient = pubClient.duplicate();
    
    const socketServer = new io.Server(server, {
      cors: {
        origin: '*', // Configure this properly in production
        methods: ['GET', 'POST']
      },
      path: '/socket.io/',
      adapter: createAdapter(pubClient, subClient)
    });
    
    const { SyncNotificationService } = await import('./services/sync/SyncNotificationService');
    SyncNotificationService.initialize(socketServer);
    logger.info('WebSocket server initialized with Redis adapter');
    // WebSocket server initialized
    
    // Initialize sync retry service
    const { SyncRetryService } = await import('./services/sync/SyncRetryService');
    await SyncRetryService.initialize();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  OTPService.stopOTPCleanup();
  if (preOrderCleanupInterval) {
    clearInterval(preOrderCleanupInterval);
  }
  const { redisService } = await import('./services/redis/RedisService');
  await redisService.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  OTPService.stopOTPCleanup();
  if (preOrderCleanupInterval) {
    clearInterval(preOrderCleanupInterval);
  }
  const { redisService } = await import('./services/redis/RedisService');
  await redisService.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export { app, prisma };