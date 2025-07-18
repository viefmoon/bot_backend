import { Router, Request, Response } from 'express';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { apiKeyAuthMiddleware } from '../common/middlewares/apiKeyAuth.middleware';
import { UnifiedSyncService } from '../services/sync/UnifiedSyncService';
import logger from '../common/utils/logger';

const router = Router();

// Sync restaurant data from local system
router.post('/sync-restaurant-data', apiKeyAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const lastSyncDate = req.body.lastSyncDate ? new Date(req.body.lastSyncDate) : undefined;
  
  try {
    const wasUpdated = await UnifiedSyncService.syncRestaurantData(lastSyncDate);
    
    res.json({
      success: true,
      updated: wasUpdated,
      message: wasUpdated ? 'Restaurant data synchronized successfully' : 'No updates available',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Restaurant data sync error:', error);
    
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
      ordersCount: changes.orders?.length || 0,
      customersCount: changes.customers?.length || 0
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


// Legacy endpoints - kept for backward compatibility
// NOTE: These endpoints are deprecated. Use POST /sync-restaurant-data instead

router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date()
  });
}));

export default router;