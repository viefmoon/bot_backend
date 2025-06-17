import { prisma } from "../../server";
import { ValidationError, ErrorCode, NotFoundError } from "../../common/services/errors";
import logger from "../../common/utils/logger";
import { DeliveryInfoInput } from "../../common/types";
import { CustomerDeliveryInfo, Prisma } from "@prisma/client";

export class DeliveryInfoService {
  /**
   * Get or create delivery info for an order
   */
  static async getOrCreateDeliveryInfo(
    orderType: 'delivery' | 'pickup',
    customerId: string,
    deliveryInfoInput?: DeliveryInfoInput
  ): Promise<any> {
    // Get customer delivery info
    const customerDeliveryInfo = await prisma.customerDeliveryInfo.findUnique({
      where: { customerId },
    });

    if (!customerDeliveryInfo) {
      throw new ValidationError(
        ErrorCode.MISSING_DELIVERY_INFO,
        'Customer delivery information not found',
        { customerId }
      );
    }

    // Build delivery info data based on order type
    let deliveryInfoData: any = {};

    if (orderType === "delivery") {
      // Use provided info or fall back to customer's default
      deliveryInfoData = {
        streetAddress: deliveryInfoInput?.streetAddress || customerDeliveryInfo.streetAddress,
        neighborhood: deliveryInfoInput?.neighborhood || customerDeliveryInfo.neighborhood,
        postalCode: deliveryInfoInput?.postalCode || customerDeliveryInfo.postalCode,
        city: deliveryInfoInput?.city || customerDeliveryInfo.city,
        state: deliveryInfoInput?.state || customerDeliveryInfo.state,
        country: deliveryInfoInput?.country || customerDeliveryInfo.country,
        latitude: deliveryInfoInput?.latitude || customerDeliveryInfo.latitude,
        longitude: deliveryInfoInput?.longitude || customerDeliveryInfo.longitude,
        geocodedAddress: deliveryInfoInput?.geocodedAddress || customerDeliveryInfo.geocodedAddress,
        additionalDetails: deliveryInfoInput?.additionalDetails || customerDeliveryInfo.additionalDetails,
      };

      // Validate required fields for delivery
      if (!deliveryInfoData.streetAddress) {
        throw new ValidationError(
          ErrorCode.MISSING_DELIVERY_INFO,
          'Street address is required for delivery orders',
          { customerId, orderType }
        );
      }
    } else if (orderType === "pickup") {
      deliveryInfoData = {
        pickupName: deliveryInfoInput?.pickupName || customerDeliveryInfo.pickupName,
      };

      // Validate required fields for pickup
      if (!deliveryInfoData.pickupName) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Pickup name is required for pickup orders',
          { customerId, orderType }
        );
      }
    }

    // Create delivery info record
    const orderDeliveryInfo = await prisma.orderDeliveryInfo.create({
      data: deliveryInfoData
    });

    logger.info(`Created delivery info ${orderDeliveryInfo.id} for ${orderType} order`);
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
        { preOrderId }
      );
    }

    if (preOrder.deliveryInfoId && preOrder.deliveryInfo) {
      // Update existing delivery info
      await prisma.orderDeliveryInfo.update({
        where: { id: preOrder.deliveryInfoId },
        data: deliveryInfo
      });
    } else {
      // Create new delivery info and link it
      const newDeliveryInfo = await prisma.orderDeliveryInfo.create({
        data: deliveryInfo
      });

      await prisma.preOrder.update({
        where: { id: preOrderId },
        data: { deliveryInfoId: newDeliveryInfo.id }
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
   * Create customer delivery info
   */
  static async createCustomerDeliveryInfo(
    data: Prisma.CustomerDeliveryInfoCreateInput
  ): Promise<CustomerDeliveryInfo> {
    try {
      const deliveryInfo = await prisma.customerDeliveryInfo.create({
        data
      });
      
      logger.info(`Created customer delivery info for customer ${data.customerId}`);
      return deliveryInfo;
    } catch (error) {
      logger.error('Error creating customer delivery info:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to create customer delivery info',
        { customerId: data.customerId }
      );
    }
  }

  /**
   * Update customer delivery info
   */
  static async updateCustomerDeliveryInfo(
    customerId: string,
    data: Prisma.CustomerDeliveryInfoUpdateInput
  ): Promise<CustomerDeliveryInfo> {
    try {
      const deliveryInfo = await prisma.customerDeliveryInfo.update({
        where: { customerId },
        data
      });
      
      logger.info(`Updated customer delivery info for customer ${customerId}`);
      return deliveryInfo;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Customer delivery info not found',
          { customerId }
        );
      }
      
      logger.error('Error updating customer delivery info:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to update customer delivery info',
        { customerId }
      );
    }
  }

  /**
   * Get customer delivery info
   */
  static async getCustomerDeliveryInfo(
    customerId: string
  ): Promise<CustomerDeliveryInfo | null> {
    try {
      const deliveryInfo = await prisma.customerDeliveryInfo.findUnique({
        where: { customerId }
      });
      
      if (!deliveryInfo) {
        throw new NotFoundError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Customer delivery info not found',
          { customerId }
        );
      }
      
      return deliveryInfo;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error fetching customer delivery info:', error);
      throw new ValidationError(
        ErrorCode.DATABASE_ERROR,
        'Failed to fetch customer delivery info',
        { customerId }
      );
    }
  }
}