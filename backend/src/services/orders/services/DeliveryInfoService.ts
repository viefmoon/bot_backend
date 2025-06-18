import { prisma } from "../../../server";
import { ValidationError, ErrorCode, NotFoundError } from "../../../common/services/errors";
import logger from "../../../common/utils/logger";
import { DeliveryInfoInput } from "../../../common/types";
import { Address, Prisma } from "@prisma/client";

export class DeliveryInfoService {
  /**
   * Get or create delivery info for an order
   */
  static async getOrCreateDeliveryInfo(
    orderType: 'delivery' | 'pickup',
    customerId: string,
    deliveryInfoInput?: DeliveryInfoInput
  ): Promise<any> {
    // Get customer's default address or first active address
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

    // Build delivery info data based on order type
    let deliveryInfoData: any = {};

    if (orderType === "delivery") {
      // Copy all address fields from customer's address
      // This creates a snapshot of the address at the time of order
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

      // Validate required fields for delivery
      if (!deliveryInfoData.street || !deliveryInfoData.number) {
        throw new ValidationError(
          ErrorCode.MISSING_DELIVERY_INFO,
          'Street address and number are required for delivery orders',
          { metadata: { customerId, orderType } }
        );
      }
    } else if (orderType === "pickup") {
      // For pickup orders, we might just need basic info
      deliveryInfoData = {
        pickupName: customerId, // Use customer ID as pickup reference
      };
    }

    // Create a copy of delivery info for this specific order
    // This preserves the address at the time of order creation
    const orderDeliveryInfo = await prisma.orderDeliveryInfo.create({
      data: deliveryInfoData
    });

    logger.info(`Created order delivery info ${orderDeliveryInfo.id} from customer address`);
    return orderDeliveryInfo;
  }

  /**
   * Update delivery info for a preorder
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
      // Update existing delivery info
      await prisma.orderDeliveryInfo.update({
        where: { id: preOrder.deliveryInfo[0].id },
        data: deliveryInfo
      });
    } else {
      // Create new delivery info and link it
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
   * Validate delivery address is within coverage area
   */
  static async validateDeliveryArea(
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    const config = await prisma.restaurantConfig.findFirst();
    
    if (!config || !config.deliveryCoverageArea) {
      // If no coverage area is defined, accept all deliveries
      return true;
    }

    // TODO: Implement actual polygon/radius check
    // For now, return true
    logger.warn('Delivery area validation not implemented yet');
    return true;
  }

  /**
   * Create customer address
   */
  static async createCustomerAddress(
    data: Prisma.AddressCreateInput
  ): Promise<Address> {
    try {
      // If this is the first address, make it default
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
      
      // If setting as default, unset other defaults
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
   * Update customer address
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
   * Copy customer address to order delivery info
   * This is a convenience method to create OrderDeliveryInfo from customer's Address
   */
  static async copyCustomerAddressToOrder(
    customerId: string,
    orderType: 'delivery' | 'pickup',
    customDeliveryInfo?: DeliveryInfoInput
  ): Promise<any> {
    return this.getOrCreateDeliveryInfo(orderType, customerId, customDeliveryInfo);
  }

  /**
   * Get all customer addresses
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
   * Get customer's default address
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
        // If no default, get the first active address
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
   * Set address as default
   */
  static async setDefaultAddress(
    addressId: string,
    customerId: string
  ): Promise<Address> {
    try {
      // Unset other defaults
      await prisma.address.updateMany({
        where: { 
          customerId,
          isDefault: true
        },
        data: { isDefault: false }
      });
      
      // Set this one as default
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
   * Soft delete address
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
      
      // Soft delete
      await prisma.address.update({
        where: { id: addressId },
        data: { 
          deletedAt: new Date()
        }
      });
      
      // If it was default, set another as default
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