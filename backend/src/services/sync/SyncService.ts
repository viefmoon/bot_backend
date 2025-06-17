import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import { Customer, SyncLog } from '@prisma/client';

export interface LocalCustomer {
  id: string; // UUID
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  email: string | null;
  birthDate: Date | null;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
  isBanned: boolean;
  banReason: string | null;
  updatedAt: Date;
  addresses?: LocalAddress[];
}

export interface LocalAddress {
  id: string; // UUID
  street: string;
  number: string;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  references?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAddress?: string | null;
  isDefault: boolean;
}

export class SyncService {
  /**
   * Sync a customer from local backend to WhatsApp backend
   */
  static async syncCustomerFromLocal(localCustomer: LocalCustomer): Promise<Customer> {
    try {
      // Map phone number to WhatsApp format (add country code if needed)
      const customerId = this.formatPhoneNumberForWhatsApp(localCustomer.phoneNumber);
      
      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { customerId }
      });

      let customer: Customer;
      
      if (existingCustomer) {
        // Update existing customer
        customer = await prisma.customer.update({
          where: { customerId },
          data: {
            localId: localCustomer.id,
            firstName: localCustomer.firstName,
            lastName: localCustomer.lastName,
            email: localCustomer.email,
            birthDate: localCustomer.birthDate,
            totalOrders: localCustomer.totalOrders,
            totalSpent: localCustomer.totalSpent,
            isActive: localCustomer.isActive,
            isBanned: localCustomer.isBanned,
            banReason: localCustomer.banReason,
            lastSyncAt: new Date(),
            syncVersion: { increment: 1 }
          }
        });
        
        await this.logSync('customer', customerId, localCustomer.id, 'update', 'local_to_cloud', 'success');
      } else {
        // Create new customer
        customer = await prisma.customer.create({
          data: {
            customerId,
            localId: localCustomer.id,
            firstName: localCustomer.firstName,
            lastName: localCustomer.lastName,
            email: localCustomer.email,
            birthDate: localCustomer.birthDate,
            totalOrders: localCustomer.totalOrders,
            totalSpent: localCustomer.totalSpent,
            isActive: localCustomer.isActive,
            isBanned: localCustomer.isBanned,
            banReason: localCustomer.banReason,
            lastSyncAt: new Date(),
            fullChatHistory: [],
            relevantChatHistory: []
          }
        });
        
        await this.logSync('customer', customerId, localCustomer.id, 'create', 'local_to_cloud', 'success');
      }
      
      logger.info(`Synced customer ${customerId} from local backend`);
      
      // Sync addresses if provided
      if (localCustomer.addresses && localCustomer.addresses.length > 0) {
        await this.syncAddressesFromLocal(customerId, localCustomer.addresses);
      }
      
      return customer;
      
    } catch (error) {
      const customerId = this.formatPhoneNumberForWhatsApp(localCustomer.phoneNumber);
      await this.logSync('customer', customerId, localCustomer.id, 'update', 'local_to_cloud', 'failed', error.message);
      logger.error('Error syncing customer from local:', error);
      throw error;
    }
  }

  /**
   * Sync addresses from local backend
   */
  static async syncAddressesFromLocal(
    customerId: string,
    localAddresses: LocalAddress[]
  ): Promise<void> {
    try {
      for (const localAddress of localAddresses) {
        const existingAddress = await prisma.address.findUnique({
          where: { localId: localAddress.id }
        });
        
        const addressData = {
          localId: localAddress.id,
          customerId,
          street: localAddress.street,
          number: localAddress.number,
          interiorNumber: localAddress.interiorNumber,
          neighborhood: localAddress.neighborhood,
          city: localAddress.city,
          state: localAddress.state,
          zipCode: localAddress.zipCode,
          country: localAddress.country,
          references: localAddress.references,
          latitude: localAddress.latitude,
          longitude: localAddress.longitude,
          geocodedAddress: localAddress.geocodedAddress,
          isDefault: localAddress.isDefault
        };
        
        if (existingAddress) {
          await prisma.address.update({
            where: { localId: localAddress.id },
            data: addressData
          });
        } else {
          // If setting as default, unset other defaults
          if (localAddress.isDefault) {
            await prisma.address.updateMany({
              where: { customerId, isDefault: true },
              data: { isDefault: false }
            });
          }
          
          await prisma.address.create({
            data: addressData
          });
        }
        
        await this.logSync('address', localAddress.id, localAddress.id, 
          existingAddress ? 'update' : 'create', 'local_to_cloud', 'success');
      }
      
      logger.info(`Synced ${localAddresses.length} addresses for customer ${customerId}`);
    } catch (error) {
      logger.error('Error syncing addresses from local:', error);
      throw error;
    }
  }

  /**
   * Sync a customer from WhatsApp backend to local backend
   * This would call your local backend API
   */
  static async syncCustomerToLocal(customer: Customer & { addresses?: any[] }): Promise<void> {
    try {
      // Get customer addresses
      const addresses = await prisma.address.findMany({
        where: { 
          customerId: customer.customerId,
          deletedAt: null
        }
      });
      
      // This would make an API call to your local backend
      // For now, just log the sync
      const syncData = {
        id: customer.localId || undefined,
        phoneNumber: this.formatPhoneNumberForLocal(customer.customerId),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        birthDate: customer.birthDate,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent?.toNumber() || 0,
        isActive: customer.isActive,
        isBanned: customer.isBanned,
        banReason: customer.banReason,
        fullChatHistory: customer.fullChatHistory,
        relevantChatHistory: customer.relevantChatHistory,
        lastInteraction: customer.lastInteraction,
        addresses: addresses.map(addr => ({
          id: addr.localId || undefined,
          street: addr.street,
          number: addr.number,
          interiorNumber: addr.interiorNumber,
          neighborhood: addr.neighborhood,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
          country: addr.country,
          references: addr.references,
          latitude: addr.latitude?.toNumber() || null,
          longitude: addr.longitude?.toNumber() || null,
          geocodedAddress: addr.geocodedAddress,
          isDefault: addr.isDefault
        }))
      };
      
      // TODO: Make API call to local backend
      // const response = await axios.post(LOCAL_BACKEND_URL + '/sync/customer', syncData);
      
      await this.logSync('customer', customer.customerId, customer.localId, 'update', 'cloud_to_local', 'success');
      logger.info(`Synced customer ${customer.customerId} to local backend with ${addresses.length} addresses`);
      
    } catch (error) {
      await this.logSync('customer', customer.customerId, customer.localId, 'update', 'cloud_to_local', 'failed', error.message);
      logger.error('Error syncing customer to local:', error);
      throw error;
    }
  }

  /**
   * Get customers that need syncing
   */
  static async getCustomersToSync(since?: Date): Promise<Customer[]> {
    return await prisma.customer.findMany({
      where: {
        OR: [
          { lastSyncAt: null },
          { lastSyncAt: { lt: since || new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      }
    });
  }

  /**
   * Format phone number for WhatsApp (ensure country code)
   */
  private static formatPhoneNumberForWhatsApp(phoneNumber: string): string {
    // Remove any non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add Mexico country code if not present
    if (!cleaned.startsWith('52')) {
      cleaned = '52' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Format phone number for local backend (remove country code if needed)
   */
  private static formatPhoneNumberForLocal(customerId: string): string {
    // Remove country code for local storage if needed
    if (customerId.startsWith('52')) {
      return customerId.substring(2);
    }
    return customerId;
  }

  /**
   * Log sync operation
   */
  private static async logSync(
    entityType: string,
    entityId: string,
    localId: string | null,
    action: string,
    syncDirection: string,
    syncStatus: string,
    errorMessage?: string
  ): Promise<SyncLog> {
    return await prisma.syncLog.create({
      data: {
        entityType,
        entityId,
        localId,
        action,
        syncDirection,
        syncStatus,
        errorMessage,
        completedAt: syncStatus === 'success' ? new Date() : null
      }
    });
  }

  /**
   * Handle conflict resolution between local and cloud
   */
  static async resolveConflict(localCustomer: LocalCustomer, cloudCustomer: Customer): Promise<Customer> {
    // Simple strategy: most recently updated wins
    const localUpdatedAt = new Date(localCustomer.updatedAt);
    const cloudUpdatedAt = new Date(cloudCustomer.updatedAt);
    
    if (localUpdatedAt > cloudUpdatedAt) {
      // Local is newer, update cloud
      return await this.syncCustomerFromLocal(localCustomer);
    } else {
      // Cloud is newer, update local
      await this.syncCustomerToLocal(cloudCustomer);
      return cloudCustomer;
    }
  }
}