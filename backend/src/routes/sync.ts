import { Router, Request, Response } from 'express';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { apiKeyAuthMiddleware } from '../common/middlewares/apiKeyAuth.middleware';
import { UnifiedSyncService } from '../services/sync/UnifiedSyncService';
import { SyncNotificationService } from '../services/sync/SyncNotificationService';
import logger from '../common/utils/logger';

const router = Router();

// Sync restaurant data from local system (PUSH method)
router.post('/push-restaurant-data', apiKeyAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    // Log detailed information about received data
    logger.info('Restaurant data push received', {
      hasMenu: !!req.body.menu,
      hasConfig: !!req.body.config,
      menuCategories: req.body.menu?.categories?.length || 0,
      configKeys: req.body.config ? Object.keys(req.body.config) : [],
      requestBodyKeys: Object.keys(req.body),
      // Log first category and product as sample
      sampleCategory: req.body.menu?.categories?.[0] ? {
        name: req.body.menu.categories[0].name,
        productsCount: req.body.menu.categories[0].products?.length || 0
      } : null,
      sampleProduct: req.body.menu?.categories?.[0]?.products?.[0] ? {
        name: req.body.menu.categories[0].products[0].name,
        price: req.body.menu.categories[0].products[0].price
      } : null
    });
    
    // Process the restaurant data
    const wasUpdated = await UnifiedSyncService.processRestaurantDataPush(req.body);
    
    res.json({
      success: true,
      updated: wasUpdated,
      message: wasUpdated ? 'Restaurant data synchronized successfully' : 'No changes detected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Restaurant data push error:', error);
    
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

// Unified sync endpoint - Pull pending changes and confirm processed ones
router.post('/pull-changes', apiKeyAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('Pull changes request received', { 
      body: req.body,
      headers: req.headers 
    });
    
    // Extract confirmations from request body
    const { confirmedOrders = [], confirmedCustomerIds = [] } = req.body;
    
    logger.info('Processing confirmations', { 
      confirmedOrdersCount: confirmedOrders.length,
      confirmedCustomerIdsCount: confirmedCustomerIds.length 
    });
    
    // Process confirmations if any
    if (confirmedOrders.length > 0 || confirmedCustomerIds.length > 0) {
      await UnifiedSyncService.confirmSyncedItems(confirmedOrders, confirmedCustomerIds);
      logger.info('Confirmations processed successfully');
    }
    
    // Get pending changes (excluding confirmed ones)
    logger.info('Fetching pending changes...');
    const changes = await UnifiedSyncService.pullChanges();
    
    logger.info('Pull changes response', {
      ordersCount: changes.pending_orders?.length || 0,
      customersCount: changes.updated_customers?.length || 0
    });
    
    res.json(changes);
  } catch (error: any) {
    logger.error('Unified sync error:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

// Debug endpoint to check WebSocket connections and send test notification
router.get('/debug/websocket', apiKeyAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const clients = SyncNotificationService.getConnectedClients();
  const isConnected = SyncNotificationService.isAnyClientConnected();
  
  logger.info('WebSocket debug endpoint called', {
    connectedClients: clients.length,
    clients
  });
  
  res.json({
    websocket: {
      connected: isConnected,
      clientCount: clients.length,
      clients
    }
  });
}));

// Send test notification to all connected clients
router.post('/debug/test-notification', apiKeyAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const result = SyncNotificationService.sendTestNotification();
  
  logger.info('Test notification sent', result);
  
  res.json(result);
}));

export default router;