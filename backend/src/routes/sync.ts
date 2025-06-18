import { Router, Request, Response } from 'express';
import { SyncService } from '../services/sync/SyncService';
import logger from '../common/utils/logger';
import { prisma } from '../server';

const router = Router();

/**
 * Sync customer from local backend
 * POST /backend/sync/customer
 */
router.post('/customer', async (req: Request, res: Response): Promise<void> => {
  try {
    const localCustomer = req.body;
    
    // Validate required fields
    if (!localCustomer.id || !localCustomer.phoneNumber) {
      res.status(400).json({ 
        error: 'Missing required fields: id and phoneNumber' 
      });
      return;
    }
    
    const customer = await SyncService.syncCustomerFromLocal(localCustomer);
    res.json({ 
      success: true, 
      customer: {
        id: customer.id,
        whatsappPhoneNumber: customer.whatsappPhoneNumber,
        syncVersion: customer.syncVersion
      }
    });
    
  } catch (error: any) {
    logger.error('Error syncing customer from local:', error);
    res.status(500).json({ 
      error: 'Failed to sync customer',
      message: error.message 
    });
  }
});

/**
 * Get customer by ID
 * GET /backend/sync/customer/:id
 */
router.get('/customer/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Search by UUID
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true }
    });
    
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    res.json({ customer });
    
  } catch (error: any) {
    logger.error('Error fetching customer by ID:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

/**
 * Batch sync customers
 * POST /backend/sync/customers/batch
 */
router.post('/customers/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customers } = req.body;
    
    if (!Array.isArray(customers)) {
      res.status(400).json({ error: 'customers must be an array' });
      return;
    }
    
    const results = [];
    const errors = [];
    
    for (const localCustomer of customers) {
      try {
        const customer = await SyncService.syncCustomerFromLocal(localCustomer);
        results.push({
          id: customer.id,
          whatsappPhoneNumber: customer.whatsappPhoneNumber,
          success: true
        });
      } catch (error: any) {
        errors.push({
          id: localCustomer.id,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      synced: results.length,
      failed: errors.length,
      results,
      errors
    });
    
  } catch (error: any) {
    logger.error('Error in batch sync:', error);
    res.status(500).json({ error: 'Batch sync failed' });
  }
});

/**
 * Get sync status
 * GET /backend/sync/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { since, entityType } = req.query;
    
    const where: any = {};
    if (since) {
      where.createdAt = { gte: new Date(since as string) };
    }
    if (entityType) {
      where.entityType = entityType;
    }
    
    const syncLogs = await prisma.syncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    const stats = await prisma.syncLog.groupBy({
      by: ['syncStatus', 'entityType'],
      _count: true,
      where
    });
    
    res.json({
      logs: syncLogs,
      stats
    });
    
  } catch (error: any) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

/**
 * Manual sync trigger
 * POST /backend/sync/trigger
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { direction = 'bidirectional', entityType = 'customer' } = req.body;
    
    if (entityType === 'customer') {
      const customers = await SyncService.getCustomersToSync();
      
      // TODO: Implement actual sync logic
      // This would call your local backend API
      
      res.json({
        message: 'Sync triggered',
        direction,
        entityType,
        itemsToSync: customers.length
      });
    } else {
      res.status(400).json({ error: 'Unsupported entity type' });
    }
    
  } catch (error: any) {
    logger.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;