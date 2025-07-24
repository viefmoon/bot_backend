import { Server as SocketIOServer } from 'socket.io';
import logger from '../../common/utils/logger';
import { prisma } from '../../lib/prisma';
import { env } from '../../common/config/envValidator';
import { SyncRetryService } from './SyncRetryService';

export class SyncNotificationService {
  private static io: SocketIOServer | null = null;
  private static connectedClients = new Map<string, string>(); // socketId -> apiKey

  /**
   * Initialize WebSocket server for real-time notifications
   */
  static initialize(io: SocketIOServer) {
    this.io = io;
    
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
        
        // Store client connection
        this.connectedClients.set(socket.id, apiKey);
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
    syncNamespace.on('connection', (socket) => {
      logger.info(`Local backend connected via WebSocket: ${socket.id}`);
      
      socket.on('disconnect', () => {
        logger.info(`Local backend disconnected: ${socket.id}`);
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
    
    // Log agregado para informar sobre la notificación de sincronización
    logger.info(`Sending changes:pending notification for new order ${orderId}. Informing ${this.connectedClients.size} clients.`);
    
    // Simply notify that there are pending changes - clients will call sync endpoint
    this.io.of('/sync').emit('changes:pending');
    
    logger.info(`Notified ${this.connectedClients.size} local backends about pending changes`);
    
    // Schedule retry if no clients are connected
    await SyncRetryService.scheduleRetryIfNeeded(orderId);
  }
  
  /**
   * Check if any local backend is connected
   */
  static isAnyClientConnected(): boolean {
    return this.connectedClients.size > 0;
  }
  
  /**
   * Get connected clients info
   */
  static getConnectedClients() {
    return Array.from(this.connectedClients.entries()).map(([socketId, apiKey]) => ({
      socketId,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    }));
  }
}