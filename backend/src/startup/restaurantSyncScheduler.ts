import logger from '../common/utils/logger';
import { UnifiedSyncService } from '../services/sync/UnifiedSyncService';

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Initialize restaurant data synchronization
 * Syncs on startup and then every 5 minutes
 */
export async function initializeRestaurantSync(): Promise<void> {
  try {
    // Sync on startup
    logger.info('Syncing restaurant data on startup...');
    await UnifiedSyncService.syncRestaurantData();
    logger.info('Initial restaurant data sync completed');
  } catch (error) {
    logger.error('Failed to sync restaurant data on startup:', error);
  }

  // Schedule periodic sync every 5 minutes
  syncInterval = setInterval(async () => {
    try {
      logger.info('Running scheduled restaurant data sync...');
      await UnifiedSyncService.syncRestaurantData();
    } catch (error) {
      logger.error('Failed to sync restaurant data:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  logger.info('Restaurant sync interval started (every 5 minutes)');
}

/**
 * Stop restaurant data synchronization
 */
export function stopRestaurantSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('Restaurant sync interval stopped');
  }
}