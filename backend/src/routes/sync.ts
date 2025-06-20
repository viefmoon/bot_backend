import { Router, Request, Response } from 'express';
import { SyncService } from '../services/sync/SyncService';
import logger from '../common/utils/logger';
import { prisma } from '../server';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { ValidationError, NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware, queryValidationMiddleware } from '../common/middlewares/validation.middleware';
import {
  SyncCustomerDto,
  BatchSyncCustomersDto,
  SyncStatusQueryDto,
  TriggerSyncDto
} from './dto/sync';

const router = Router();

/**
 * Sync customer from local backend
 * POST /backend/sync/customer
 */
router.post('/customer',
  validationMiddleware(SyncCustomerDto),
  asyncHandler(async (req: Request, res: Response) => {
    const localCustomer = req.body as SyncCustomerDto;
  
  const customer = await SyncService.syncCustomerFromLocal(localCustomer);
  res.json({ 
    success: true, 
    customer: {
      id: customer.id,
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      syncVersion: customer.syncVersion
    }
  });
}));

/**
 * Get customer by ID
 * GET /backend/sync/customer/:id
 */
router.get('/customer/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Search by UUID
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { addresses: true }
  });
  
  if (!customer) {
    throw new NotFoundError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { customerId: id }
    );
  }
  
  res.json({ customer });
}));

/**
 * Batch sync customers
 * POST /backend/sync/customers/batch
 */
router.post('/customers/batch',
  validationMiddleware(BatchSyncCustomersDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customers } = req.body as BatchSyncCustomersDto;
  
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
}));

/**
 * Get sync status
 * GET /backend/sync/status
 */
router.get('/status',
  queryValidationMiddleware(SyncStatusQueryDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { since, entityType } = req.query as unknown as SyncStatusQueryDto;
  
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
}));

/**
 * Manual sync trigger
 * POST /backend/sync/trigger
 */
router.post('/trigger',
  validationMiddleware(TriggerSyncDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { direction = 'bidirectional', entityType = 'customer' } = req.body as TriggerSyncDto;
  
  if (entityType !== 'customer') {
    throw new ValidationError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Unsupported entity type'
    );
  }
  
  const customers = await SyncService.getCustomersToSync();
  
  // TODO: Implement actual sync logic
  // This would call your local backend API
  
  res.json({
    message: 'Sync triggered',
    direction,
    entityType,
    itemsToSync: customers.length
  });
}));

export default router;