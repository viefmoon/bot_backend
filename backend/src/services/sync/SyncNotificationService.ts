import { Server as SocketIOServer } from 'socket.io';
import IORedis from 'ioredis';
import logger from '../../common/utils/logger';
import { prisma } from '../../lib/prisma';
import { env } from '../../common/config/envValidator';
import { SyncRetryService } from './SyncRetryService';

export class SyncNotificationService {
  private static io: SocketIOServer | null = null;
  private static connectedClients = new Map<string, string>(); // socketId -> apiKey (memoria local - legacy)
  private static redisClient: IORedis | null = null;
  private static readonly REDIS_KEY_SYNC_CLIENTS = 'sync:connected_clients';

  /**
   * Initialize WebSocket server for real-time notifications
   */
  static initialize(io: SocketIOServer) {
    this.io = io;
    
    // Initialize Redis client for shared state
    this.redisClient = new IORedis({
      host: env.REDIS_HOST || 'localhost',
      port: parseInt(env.REDIS_PORT || '6380', 10),
      password: env.REDIS_PASSWORD,
    });
    
    // Create sync namespace
    const syncNamespace = io.of('/sync');
    
    syncNamespace.use(async (socket, next) => {
      try {
        const apiKey = socket.handshake.auth.apiKey;
        
        if (!apiKey) {
          return next(new Error('API key required'));
        }
        
        // Validate API key
        if (!env.CLOUD_API_KEY || apiKey !== env.CLOUD_API_KEY) {
          return next(new Error('Invalid API key'));
        }
        
        // Store client connection in Redis
        await this.redisClient?.hset(this.REDIS_KEY_SYNC_CLIENTS, socket.id, apiKey);
        // Also keep in memory for legacy
        this.connectedClients.set(socket.id, apiKey);
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
    syncNamespace.on('connection', (socket) => {
      logger.info(`Local backend connected via WebSocket: ${socket.id}`);
      
      socket.on('disconnect', async () => {
        logger.info(`Local backend disconnected: ${socket.id}`);
        // Remove from Redis
        await this.redisClient?.hdel(this.REDIS_KEY_SYNC_CLIENTS, socket.id);
        // Also remove from memory
        this.connectedClients.delete(socket.id);
      });
      
      // Client can request immediate sync
      socket.on('sync:orders', async () => {
        // Get pending order IDs from sync metadata
        const pendingMeta = await prisma.syncMetadata.findMany({
          where: {
            entityType: 'Order',
            syncPending: true
          },
          select: { entityId: true }
        });
        
        const orderIds = pendingMeta.map(m => m.entityId);
        
        const pendingOrders = orderIds.length > 0 ? await prisma.order.findMany({
          where: {
            id: { in: orderIds },
            isFromWhatsApp: true
          }
        }) : [];
        
        socket.emit('orders:pending', {
          count: pendingOrders.length,
          orders: pendingOrders
        });
      });
    });
    
    logger.info('WebSocket sync notification service initialized');
  }
  
  /**
   * Notify all connected local backends about pending changes
   */
  static async notifyPendingChanges(orderId: string) {
    if (!this.io) {
      logger.warn('WebSocket not initialized, cannot send notification');
      return;
    }
    
    // Get client count from Redis
    const clientCount = await this.getConnectedClientCount();
    
    // Log agregado para informar sobre la notificación de sincronización
    logger.info(`Sending changes:pending notification for new order ${orderId}. Informing ${clientCount} clients (from Redis).`);
    
    // Simply notify that there are pending changes - clients will call sync endpoint
    this.io.of('/sync').emit('changes:pending');
    
    logger.info(`Notified ${clientCount} local backends about pending changes`);
    
    // Schedule retry if no clients are connected
    await SyncRetryService.scheduleRetryIfNeeded(orderId);
  }
  
  /**
   * Check if any local backend is connected
   */
  static async isAnyClientConnected(): Promise<boolean> {
    const count = await this.getConnectedClientCount();
    return count > 0;
  }
  
  /**
   * Get connected client count from Redis
   */
  private static async getConnectedClientCount(): Promise<number> {
    if (!this.redisClient) return 0;
    const clients = await this.redisClient.hkeys(this.REDIS_KEY_SYNC_CLIENTS);
    return clients.length;
  }
  
  /**
   * Get connected clients info
   */
  static async getConnectedClients() {
    if (!this.redisClient) return [];
    
    const clients = await this.redisClient.hgetall(this.REDIS_KEY_SYNC_CLIENTS);
    return Object.entries(clients).map(([socketId, apiKey]) => ({
      socketId,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    }));
  }
  
  /**
   * Send test notification to all connected clients
   */
  static sendTestNotification() {
    if (!this.io) {
      logger.warn('WebSocket not initialized');
      return { success: false, message: 'WebSocket not initialized' };
    }
    
    const clientCount = this.connectedClients.size;
    logger.info(`Sending test notification to ${clientCount} connected clients`);
    
    // Send test notification
    this.io.of('/sync').emit('changes:pending');
    
    return { 
      success: true, 
      message: `Test notification sent to ${clientCount} clients`,
      connectedClients: this.getConnectedClients()
    };
  }
}