import { prisma } from '../../lib/prisma';

export class SyncService {
  /**
   * Log a sync operation
   */
  static async logSync(
    syncType: string,
    recordsAffected: number,
    status: 'SUCCESS' | 'FAILED',
    error?: string
  ): Promise<void> {
    await prisma.syncLog.create({
      data: {
        syncType,
        recordsAffected,
        status,
        error,
        completedAt: new Date()
      }
    });
  }
}