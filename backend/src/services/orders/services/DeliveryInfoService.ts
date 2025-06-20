import { prisma } from "../../../server";
import { ValidationError, ErrorCode, NotFoundError } from "../../../common/services/errors";
import logger from "../../../common/utils/logger";
import { DeliveryInfoInput } from "../../../common/types";
import { Address, Prisma } from "@prisma/client";

export class DeliveryInfoService {
  /**
   * Obtener o crear información de entrega para una orden
   */
  static async getOrCreateDeliveryInfo(
    orderType: 'delivery' | 'pickup',
    customerId: string,
    deliveryInfoInput?: DeliveryInfoInput
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

    if (orderType === "delivery") {
      // Copiar todos los campos de dirección desde la dirección del cliente
      // Esto crea una instantánea de la dirección en el momento de la orden
      deliveryInfoData = {
        street: deliveryInfoInput?.street || customerAddress.street,
        number: customerAddress.number,
        interiorNumber: customerAddress.interiorNumber,
        neighborhood: deliveryInfoInput?.neighborhood || customerAddress.neighborhood,
        zipCode: deliveryInfoInput?.zipCode || customerAddress.zipCode,
        city: deliveryInfoInput?.city || customerAddress.city,
        state: deliveryInfoInput?.state || customerAddress.state,
        country: deliveryInfoInput?.country || customerAddress.country,
        latitude: deliveryInfoInput?.latitude || customerAddress.latitude?.toNumber(),
        longitude: deliveryInfoInput?.longitude || customerAddress.longitude?.toNumber(),
        references: deliveryInfoInput?.references || customerAddress.references,
      };

      // Validar campos requeridos para entrega
      if (!deliveryInfoData.street || !deliveryInfoData.number) {
        throw new ValidationError(
          ErrorCode.MISSING_DELIVERY_INFO,
          'Street address and number are required for delivery orders',
          { metadata: { customerId, orderType } }
        );
      }
    } else if (orderType === "pickup") {
      // Para órdenes de recogida, quizás solo necesitemos información básica
      deliveryInfoData = {
        pickupName: customerId, // Usar ID del cliente como referencia de recogida
      };
    }

    // Crear una copia de información de entrega para esta orden específica
    // Esto preserva la dirección en el momento de creación de la orden
    const orderDeliveryInfo = await prisma.orderDeliveryInfo.create({
      data: deliveryInfoData
    });

    logger.info(`Created order delivery info ${orderDeliveryInfo.id} from customer address`);
    return orderDeliveryInfo;
  }

  /**
   * Actualizar información de entrega para una preorden
   */
  static async updatePreOrderDeliveryInfo(
    preOrderId: number,
    deliveryInfo: DeliveryInfoInput
  ): Promise<void> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: { deliveryInfo: true }
    });

    if (!preOrder) {
      throw new ValidationError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { metadata: { preOrderId } }
      );
    }

    if (preOrder.deliveryInfo && preOrder.deliveryInfo.length > 0 && preOrder.deliveryInfo[0].id) {
      // Actualizar información de entrega existente
      await prisma.orderDeliveryInfo.update({
        where: { id: preOrder.deliveryInfo[0].id },
        data: deliveryInfo
      });
    } else {
      // Crear nueva información de entrega y vincularla
      const newDeliveryInfo = await prisma.orderDeliveryInfo.create({
        data: deliveryInfo
      });

      await prisma.preOrder.update({
        where: { id: preOrderId },
        data: {
          deliveryInfo: {
            connect: { id: newDeliveryInfo.id }
          }
        }
      });
    }

    logger.info(`Updated delivery info for preorder ${preOrderId}`);
  }

  /**
   * Validar que la dirección de entrega esté dentro del área de cobertura
   */
  static async validateDeliveryArea(
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    const config = await prisma.restaurantConfig.findFirst();
    
    if (!config || !config.deliveryCoverageArea) {
      // Si no se define área de cobertura, aceptar todas las entregas
      return true;
    }

    // TODO: Implementar verificación real de polígono/radio
    // Por ahora, retornar true
    logger.warn('Delivery area validation not implemented yet');
    return true;
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
   * Copiar dirección del cliente a información de entrega de orden
   * Este es un método de conveniencia para crear OrderDeliveryInfo desde la Address del cliente
   */
  static async copyCustomerAddressToOrder(
    customerId: string,
    orderType: 'delivery' | 'pickup',
    customDeliveryInfo?: DeliveryInfoInput
  ): Promise<any> {
    return this.getOrCreateDeliveryInfo(orderType, customerId, customDeliveryInfo);
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
    customerId: string
  ): Promise<Address> {
    try {
      // Desmarcar otras predeterminadas
      await prisma.address.updateMany({
        where: { 
          customerId,
          isDefault: true
        },
        data: { isDefault: false }
      });
      
      // Establecer esta como predeterminada
      const address = await prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
      
      logger.info(`Set address ${addressId} as default for customer ${customerId}`);
      return address;
    } catch (error) {
      logger.error('Error setting default address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to set default address',
        { metadata: { addressId, customerId } }
      );
    }
  }

  /**
   * Eliminación suave de dirección
   */
  static async deleteCustomerAddress(
    addressId: string,
    customerId: string
  ): Promise<void> {
    try {
      const address = await prisma.address.findFirst({
        where: { id: addressId, customerId }
      });
      
      if (!address) {
        throw new NotFoundError(
          ErrorCode.ORDER_NOT_FOUND,
          'Address not found',
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
      
      // Si era predeterminada, establecer otra como predeterminada
      if (address.isDefault) {
        const nextDefault = await prisma.address.findFirst({
          where: { 
            customerId,
            deletedAt: null,
            id: { not: addressId }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (nextDefault) {
          await this.setDefaultAddress(nextDefault.id, customerId);
        }
      }
      
      logger.info(`Soft deleted address ${addressId} for customer ${customerId}`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error deleting address:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to delete address',
        { metadata: { addressId, customerId } }
      );
    }
  }
}