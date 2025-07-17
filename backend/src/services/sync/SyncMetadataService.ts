import { prisma } from '../../lib/prisma';
import logger from '../../common/utils/logger';

export type SyncEntityType = 'Order' | 'Customer' | 'Address' | 'Product' | 'Category';
export type ModifiedBy = 'LOCAL' | 'REMOTE';

export class SyncMetadataService {
  /**
   * Mark an entity for synchronization
   */
  static async markForSync(
    entityType: SyncEntityType,
    entityId: string,
    modifiedBy: ModifiedBy = 'REMOTE'
  ): Promise<void> {
    try {
      await prisma.syncMetadata.upsert({
        where: {
          entityType_entityId: { entityType, entityId }
        },
        create: {
          entityType,
          entityId,
          modifiedBy,
          syncPending: true
        },
        update: {
          modifiedBy,
          syncPending: true,
          syncVersion: { increment: 1 }
        }
      });
      
      logger.debug(`Marked ${entityType}:${entityId} for sync by ${modifiedBy}`);
    } catch (error) {
      logger.error(`Error marking entity for sync: ${entityType}:${entityId}`, error);
      throw error;
    }
  }

  /**
   * Mark multiple entities as synced
   */
  static async markAsSynced(
    entities: Array<{ entityType: SyncEntityType; entityId: string }>
  ): Promise<void> {
    try {
      const updates = entities.map(({ entityType, entityId }) =>
        prisma.syncMetadata.update({
          where: {
            entityType_entityId: { entityType, entityId }
          },
          data: {
            syncPending: false
          }
        })
      );
      
      await prisma.$transaction(updates);
      
      logger.debug(`Marked ${entities.length} entities as synced`);
    } catch (error) {
      logger.error('Error marking entities as synced', error);
      throw error;
    }
  }

  /**
   * Get entities pending synchronization
   */
  static async getPendingSync(
    entityType: SyncEntityType,
    limit: number = 100
  ): Promise<Array<{ entityId: string; lastModifiedAt: Date; modifiedBy: string }>> {
    const pending = await prisma.syncMetadata.findMany({
      where: {
        entityType,
        syncPending: true
      },
      orderBy: {
        lastModifiedAt: 'asc'
      },
      take: limit
    });
    
    return pending.map(p => ({
      entityId: p.entityId,
      lastModifiedAt: p.lastModifiedAt,
      modifiedBy: p.modifiedBy
    }));
  }

  /**
   * Get sync status for a specific entity
   */
  static async getSyncStatus(
    entityType: SyncEntityType,
    entityId: string
  ): Promise<{
    exists: boolean;
    syncPending: boolean;
    lastModifiedAt: Date | null;
    modifiedBy: string | null;
    syncVersion: number;
  }> {
    const metadata = await prisma.syncMetadata.findUnique({
      where: {
        entityType_entityId: { entityType, entityId }
      }
    });
    
    if (!metadata) {
      return {
        exists: false,
        syncPending: false,
        lastModifiedAt: null,
        modifiedBy: null,
        syncVersion: 0
      };
    }
    
    return {
      exists: true,
      syncPending: metadata.syncPending,
      lastModifiedAt: metadata.lastModifiedAt,
      modifiedBy: metadata.modifiedBy,
      syncVersion: metadata.syncVersion
    };
  }

  /**
   * Get entities modified since a specific date
   */
  static async getModifiedSince(
    entityType: SyncEntityType,
    since: Date,
    modifiedBy?: ModifiedBy
  ): Promise<string[]> {
    const where: any = {
      entityType,
      lastModifiedAt: { gt: since }
    };
    
    if (modifiedBy) {
      where.modifiedBy = modifiedBy;
    }
    
    const modified = await prisma.syncMetadata.findMany({
      where,
      select: {
        entityId: true
      }
    });
    
    return modified.map(m => m.entityId);
  }

  /**
   * Initialize sync metadata for existing entities
   * Used during migration from old system
   */
  static async initializeForExistingEntities(): Promise<void> {
    logger.info('Initializing sync metadata for existing entities...');
    
    // Initialize for existing customers
    const customers = await prisma.customer.findMany({
      select: { id: true }
    });
    
    for (const customer of customers) {
      await this.markForSync('Customer', customer.id, 'REMOTE');
    }
    
    // Initialize for existing orders
    const orders = await prisma.order.findMany({
      select: { id: true }
    });
    
    for (const order of orders) {
      await this.markForSync('Order', order.id, 'REMOTE');
    }
    
    // Initialize for existing addresses
    const addresses = await prisma.address.findMany({
      select: { id: true }
    });
    
    for (const address of addresses) {
      await this.markForSync('Address', address.id, 'REMOTE');
    }
    
    // Mark all as already synced (they're existing data)
    await prisma.syncMetadata.updateMany({
      data: { syncPending: false }
    });
    
    logger.info('Sync metadata initialization completed');
  }

  /**
   * Clean up orphaned sync metadata
   */
  static async cleanupOrphaned(): Promise<number> {
    // This would need to check each entity type
    // For now, just return 0
    logger.warn('Orphaned sync metadata cleanup not implemented yet');
    return 0;
  }
}