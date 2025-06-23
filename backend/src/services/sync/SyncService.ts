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
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export class SyncService {
  /**
   * Sincronizar un cliente desde el backend local al backend de WhatsApp
   */
  static async syncCustomerFromLocal(localCustomer: LocalCustomer): Promise<Customer> {
    try {
      // Mapear número de teléfono al formato de WhatsApp (agregar código de país si es necesario)
      const whatsappPhoneNumber = this.formatPhoneNumberForWhatsApp(localCustomer.phoneNumber);
      
      // Verificar si el cliente existe por número de teléfono
      const existingCustomer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });

      let customer: Customer;
      
      if (existingCustomer) {
        // Actualizar cliente existente
        customer = await prisma.customer.update({
          where: { whatsappPhoneNumber },
          data: {
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
        
        await this.logSync('customer', customer.id, 'update', 'local_to_cloud', 'success');
      } else {
        // Crear nuevo cliente con el mismo UUID que el local
        customer = await prisma.customer.create({
          data: {
            id: localCustomer.id, // Usar el mismo UUID que el backend local
            whatsappPhoneNumber,
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
        
        await this.logSync('customer', customer.id, 'create', 'local_to_cloud', 'success');
      }
      
      logger.info(`Synced customer ${customer.id} with phone ${whatsappPhoneNumber} from local backend`);
      
      // Sincronizar direcciones si se proporcionan
      if (localCustomer.addresses && localCustomer.addresses.length > 0) {
        await this.syncAddressesFromLocal(customer.id, localCustomer.addresses);
      }
      
      return customer;
      
    } catch (error) {
      const whatsappPhoneNumber = this.formatPhoneNumberForWhatsApp(localCustomer.phoneNumber);
      await this.logSync('customer', localCustomer.id, 'update', 'local_to_cloud', 'failed', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Error syncing customer from local:', error);
      throw error;
    }
  }

  /**
   * Sincronizar direcciones desde el backend local
   */
  static async syncAddressesFromLocal(
    customerId: string,
    localAddresses: LocalAddress[]
  ): Promise<void> {
    try {
      for (const localAddress of localAddresses) {
        const existingAddress = await prisma.address.findUnique({
          where: { id: localAddress.id }
        });
        
        const addressData = {
          id: localAddress.id, // Usar el mismo UUID que el backend local
          customerId,
          street: localAddress.street,
          number: localAddress.number,
          interiorNumber: localAddress.interiorNumber,
          neighborhood: localAddress.neighborhood,
          city: localAddress.city,
          state: localAddress.state,
          zipCode: localAddress.zipCode,
          country: localAddress.country,
          deliveryInstructions: localAddress.deliveryInstructions,
          latitude: localAddress.latitude,
          longitude: localAddress.longitude,
          isDefault: localAddress.isDefault
        };
        
        if (existingAddress) {
          await prisma.address.update({
            where: { id: localAddress.id },
            data: addressData
          });
        } else {
          // Si se establece como predeterminada, desmarcar otras predeterminadas
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
        
        await this.logSync('address', localAddress.id, 
          existingAddress ? 'update' : 'create', 'local_to_cloud', 'success');
      }
      
      logger.info(`Synced ${localAddresses.length} addresses for customer ${customerId}`);
    } catch (error) {
      logger.error('Error syncing addresses from local:', error);
      throw error;
    }
  }

  /**
   * Sincronizar un cliente desde el backend de WhatsApp al backend local
   * Esto llamaría a tu API del backend local
   */
  static async syncCustomerToLocal(customer: Customer & { addresses?: any[] }): Promise<void> {
    try {
      // Obtener direcciones del cliente
      const addresses = await prisma.address.findMany({
        where: { 
          customerId: customer.id,
          deletedAt: null
        }
      });
      
      // Esto haría una llamada API a tu backend local
      // Por ahora, solo registrar la sincronización
      const syncData = {
        id: customer.id,
        phoneNumber: this.formatPhoneNumberForLocal(customer.whatsappPhoneNumber),
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
          id: addr.id,
          street: addr.street,
          number: addr.number,
          interiorNumber: addr.interiorNumber,
          neighborhood: addr.neighborhood,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
          country: addr.country,
          deliveryInstructions: addr.deliveryInstructions,
          latitude: addr.latitude?.toNumber() || null,
          longitude: addr.longitude?.toNumber() || null,
          isDefault: addr.isDefault
        }))
      };
      
      // TODO: Hacer llamada API al backend local
      // const response = await axios.post(LOCAL_BACKEND_URL + '/sync/customer', syncData);
      
      await this.logSync('customer', customer.id, 'update', 'cloud_to_local', 'success');
      logger.info(`Synced customer ${customer.id} to local backend with ${addresses.length} addresses`);
      
    } catch (error) {
      await this.logSync('customer', customer.id, 'update', 'cloud_to_local', 'failed', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Error syncing customer to local:', error);
      throw error;
    }
  }

  /**
   * Obtener clientes que necesitan sincronización
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
   * Formatear número de teléfono para WhatsApp (asegurar código de país)
   */
  private static formatPhoneNumberForWhatsApp(phoneNumber: string): string {
    // Eliminar cualquier carácter no numérico
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Agregar código de país de México si no está presente
    if (!cleaned.startsWith('52')) {
      cleaned = '52' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Formatear número de teléfono para backend local (eliminar código de país si es necesario)
   */
  private static formatPhoneNumberForLocal(whatsappPhoneNumber: string): string {
    // Eliminar código de país para almacenamiento local si es necesario
    if (whatsappPhoneNumber.startsWith('52')) {
      return whatsappPhoneNumber.substring(2);
    }
    return whatsappPhoneNumber;
  }

  /**
   * Registrar operación de sincronización
   */
  private static async logSync(
    entityType: string,
    entityId: string,
    action: string,
    syncDirection: string,
    syncStatus: string,
    errorMessage?: string
  ): Promise<SyncLog> {
    return await prisma.syncLog.create({
      data: {
        entityType,
        entityId,
        action,
        syncDirection,
        syncStatus,
        errorMessage,
        completedAt: syncStatus === 'success' ? new Date() : null
      }
    });
  }

  /**
   * Manejar resolución de conflictos entre local y nube
   */
  static async resolveConflict(localCustomer: LocalCustomer, cloudCustomer: Customer): Promise<Customer> {
    // Estrategia simple: el más recientemente actualizado gana
    const localUpdatedAt = new Date(localCustomer.updatedAt);
    const cloudUpdatedAt = new Date(cloudCustomer.updatedAt);
    
    if (localUpdatedAt > cloudUpdatedAt) {
      // Local es más nuevo, actualizar nube
      return await this.syncCustomerFromLocal(localCustomer);
    } else {
      // Nube es más nueva, actualizar local
      await this.syncCustomerToLocal(cloudCustomer);
      return cloudCustomer;
    }
  }
}