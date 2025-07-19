import { prisma } from '../../server';
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
}