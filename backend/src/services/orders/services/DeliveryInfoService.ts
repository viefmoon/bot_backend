import { prisma } from '../../../lib/prisma';
import { ValidationError, ErrorCode, NotFoundError } from "../../../common/services/errors";
import logger from "../../../common/utils/logger";
import { DeliveryInfoInput } from "../../../common/types";
import { Address, Prisma, OrderType } from "@prisma/client";
import { SyncMetadataService } from "../../sync/SyncMetadataService";

export class DeliveryInfoService {
  /**
   * Obtener o crear información de entrega para una orden
   */
  static async getOrCreateDeliveryInfo(
    orderType: OrderType,
    customerId: string,
    deliveryInfoInput?: DeliveryInfoInput,
    customerData?: { firstName?: string | null, lastName?: string | null, whatsappPhoneNumber: string }
  ): Promise<any> {
    // Obtener la dirección predeterminada del cliente o la primera dirección activa
    const customerAddress = await prisma.address.findFirst({
      where: { 
        customerId,
        deletedAt: null
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (!customerAddress) {
      throw new ValidationError(
        ErrorCode.MISSING_DELIVERY_INFO,
        'Customer has no active addresses',
        { metadata: { customerId } }
      );
    }

    // Construir datos de información de entrega basados en el tipo de orden
    let deliveryInfoData: any = {};

    if (orderType === OrderType.DELIVERY) {
      // Copiar todos los campos de dirección desde la dirección del cliente
      // Esto crea una instantánea de la dirección en el momento de la orden
      deliveryInfoData = {
        street: deliveryInfoInput?.street || customerAddress.street,
        number: deliveryInfoInput?.number || customerAddress.number,
        interiorNumber: deliveryInfoInput?.interiorNumber || customerAddress.interiorNumber,
        neighborhood: deliveryInfoInput?.neighborhood || customerAddress.neighborhood,
        zipCode: deliveryInfoInput?.zipCode || customerAddress.zipCode,
        city: deliveryInfoInput?.city || customerAddress.city,
        state: deliveryInfoInput?.state || customerAddress.state,
        country: deliveryInfoInput?.country || customerAddress.country,
        latitude: deliveryInfoInput?.latitude || customerAddress.latitude?.toNumber(),
        longitude: deliveryInfoInput?.longitude || customerAddress.longitude?.toNumber(),
        deliveryInstructions: deliveryInfoInput?.deliveryInstructions || customerAddress.deliveryInstructions,
        recipientName: deliveryInfoInput?.recipientName || 
          (customerData ? `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || null : null),
        recipientPhone: deliveryInfoInput?.recipientPhone || customerData?.whatsappPhoneNumber,
      };

      // Validar campos requeridos para entrega
      if (!deliveryInfoData.street || !deliveryInfoData.number) {
        throw new ValidationError(
          ErrorCode.MISSING_DELIVERY_INFO,
          'Street address and number are required for delivery orders',
          { metadata: { customerId, orderType } }
        );
      }
    } else if (orderType === OrderType.TAKE_AWAY) {
      // Para órdenes de recogida, guardar quien recogerá la orden
      deliveryInfoData = {
        recipientName: deliveryInfoInput?.recipientName || 
          (customerData ? `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || null : null),
        recipientPhone: deliveryInfoInput?.recipientPhone || customerData?.whatsappPhoneNumber,
      };
    }

    // Crear una copia de información de entrega para esta orden específica
    // Esto preserva la dirección en el momento de creación de la orden
    const deliveryInfo = await prisma.deliveryInfo.create({
      data: deliveryInfoData
    });

    logger.info(`Created delivery info ${deliveryInfo.id} from customer address`);
    return deliveryInfo;
  }



  /**
   * Crear dirección del cliente
   */
  static async createCustomerAddress(
    data: Prisma.AddressCreateInput
  ): Promise<Address> {
    try {
      // Si esta es la primera dirección, hacerla predeterminada
      const existingAddresses = await prisma.address.count({
        where: { 
          customerId: data.customer.connect?.id || data.customer.connectOrCreate?.where.id,
          deletedAt: null
        }
      });
      
      const addressData = {
        ...data,
        isDefault: existingAddresses === 0 ? true : (data.isDefault || false)
      };
      
      // Si se establece como predeterminada, desmarcar otras predeterminadas
      if (addressData.isDefault) {
        await prisma.address.updateMany({
          where: { 
            customerId: data.customer.connect?.id || data.customer.connectOrCreate?.where.id,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }
      
      const address = await prisma.address.create({
        data: addressData
      });
      
      // Mark for sync
      await SyncMetadataService.markForSync('Address', address.id, 'REMOTE');
      
      logger.info(`Created customer address ${address.id} for customer ${address.customerId}`);
      return address;
    } catch (error) {
      logger.error('Error creating customer address:', error);
      throw new ValidationError(ErrorCode.DATABASE_ERROR, 'Failed to create customer address', { metadata: { error: error instanceof Error ? error.message : 'Unknown error' } });
    }
  }

  /**
   * Actualizar dirección del cliente
   */
  static async updateCustomerAddress(
    addressId: string,
    data: Prisma.AddressUpdateInput
  ): Promise<Address> {
    try {
      const deliveryInfo = await prisma.address.update({
        where: { id: addressId },
        data
      });
      
      // Mark for sync
      await SyncMetadataService.markForSync('Address', addressId, 'REMOTE');
      
      logger.info(`Updated address ${addressId}`);
      return deliveryInfo;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError(
          ErrorCode.ORDER_NOT_FOUND,
          'Address not found',
          { metadata: { addressId } }
        );
      }
      
      logger.error('Error updating customer address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to update customer address',
        { metadata: { addressId } }
      );
    }
  }


  /**
   * Obtener todas las direcciones del cliente
   */
  static async getCustomerAddresses(
    customerId: string,
    includeInactive: boolean = false
  ): Promise<Address[]> {
    try {
      const addresses = await prisma.address.findMany({
        where: { 
          customerId,
          ...(includeInactive ? {} : { deletedAt: null })
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      return addresses;
    } catch (error) {
      logger.error('Error fetching customer addresses:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to fetch customer addresses',
        { metadata: { customerId } }
      );
    }
  }

  /**
   * Obtener la dirección predeterminada del cliente
   */
  static async getCustomerDefaultAddress(
    customerId: string
  ): Promise<Address | null> {
    try {
      const address = await prisma.address.findFirst({
        where: { 
          customerId,
          isDefault: true,
          deletedAt: null
        }
      });
      
      if (!address) {
        // Si no hay predeterminada, obtener la primera dirección activa
        const firstAddress = await prisma.address.findFirst({
          where: { 
            customerId,
            deletedAt: null
          },
          orderBy: { createdAt: 'desc' }
        });
        
        return firstAddress;
      }
      
      return address;
    } catch (error) {
      logger.error('Error fetching default address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to fetch default address',
        { metadata: { customerId } }
      );
    }
  }

  /**
   * Establecer dirección como predeterminada
   */
  static async setDefaultAddress(
    addressId: string,
    customerId?: string
  ): Promise<Address> {
    try {
      // Get the address first to verify it exists and get customerId if not provided
      const address = await prisma.address.findUnique({
        where: { id: addressId },
        select: { customerId: true }
      });
      
      if (!address) {
        throw new NotFoundError(
          ErrorCode.ADDRESS_NOT_FOUND,
          'Address not found',
          { metadata: { addressId } }
        );
      }
      
      // Use provided customerId or the one from the address
      const actualCustomerId = customerId || address.customerId;
      
      // Verify ownership if customerId was provided
      if (customerId && address.customerId !== customerId) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Address does not belong to customer',
          { metadata: { addressId, customerId } }
        );
      }
      
      // Desmarcar otras predeterminadas
      const previousDefaults = await prisma.address.findMany({
        where: { 
          customerId: actualCustomerId,
          isDefault: true
        },
        select: { id: true }
      });
      
      await prisma.address.updateMany({
        where: { 
          customerId: actualCustomerId,
          isDefault: true
        },
        data: { isDefault: false }
      });
      
      // Mark previous defaults for sync
      for (const prevDefault of previousDefaults) {
        await SyncMetadataService.markForSync('Address', prevDefault.id, 'REMOTE');
      }
      
      // Establecer esta como predeterminada
      const updatedAddress = await prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
      
      // Mark new default for sync
      await SyncMetadataService.markForSync('Address', addressId, 'REMOTE');
      
      logger.info(`Set address ${addressId} as default for customer ${actualCustomerId}`);
      return updatedAddress;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      
      logger.error('Error setting default address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to set default address',
        { metadata: { addressId } }
      );
    }
  }

  /**
   * Eliminación suave de dirección
   */
  static async deleteCustomerAddress(
    addressId: string,
    customerId?: string
  ): Promise<void> {
    try {
      // Get the address to verify ownership
      const address = await prisma.address.findUnique({
        where: { id: addressId }
      });
      
      if (!address) {
        throw new NotFoundError(
          ErrorCode.ADDRESS_NOT_FOUND,
          'Address not found',
          { metadata: { addressId } }
        );
      }
      
      // Verify ownership if customerId was provided
      if (customerId && address.customerId !== customerId) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Address does not belong to customer',
          { metadata: { addressId, customerId } }
        );
      }
      
      // Eliminación suave
      await prisma.address.update({
        where: { id: addressId },
        data: { 
          deletedAt: new Date()
        }
      });
      
      // Mark for sync
      await SyncMetadataService.markForSync('Address', addressId, 'REMOTE');
      
      // Si era predeterminada, establecer otra como predeterminada
      if (address.isDefault) {
        const nextDefault = await prisma.address.findFirst({
          where: { 
            customerId: address.customerId,
            deletedAt: null,
            id: { not: addressId }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (nextDefault) {
          await this.setDefaultAddress(nextDefault.id, address.customerId);
        }
      }
      
      logger.info(`Soft deleted address ${addressId} for customer ${address.customerId}`);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      
      logger.error('Error deleting address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to delete address',
        { metadata: { addressId } }
      );
    }
  }
}