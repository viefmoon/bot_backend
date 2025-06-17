import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import { Customer } from '../../common/types';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';

/**
 * Service for managing customer-related operations
 */
export class CustomerService {
  /**
   * Check if a customer is banned
   */
  static async isCustomerBanned(customerId: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { customerId },
        select: { isBanned: true }
      });
      
      return customer?.isBanned ?? false;
    } catch (error) {
      logger.error('Error checking if customer is banned:', error);
      return false;
    }
  }

  /**
   * Get or create a customer
   */
  static async getOrCreateCustomer(customerId: string): Promise<Customer> {
    try {
      let customer = await prisma.customer.findUnique({
        where: { customerId }
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: { customerId }
        });
        logger.info(`Created new customer: ${customerId}`);
      }

      return customer;
    } catch (error) {
      logger.error('Error getting or creating customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to get or create customer',
        { metadata: { customerId } }
      );
    }
  }

  /**
   * Update customer information
   */
  static async updateCustomer(
    customerId: string, 
    data: Partial<Customer>
  ): Promise<Customer> {
    try {
      const customer = await prisma.customer.update({
        where: { customerId },
        data
      });

      logger.info(`Updated customer ${customerId}:`, data);
      return customer;
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to update customer',
        { metadata: { customerId, data } }
      );
    }
  }

  /**
   * Ban a customer
   */
  static async banCustomer(customerId: string, reason?: string): Promise<void> {
    try {
      await prisma.customer.update({
        where: { customerId },
        data: { 
          isBanned: true,
          updatedAt: new Date()
        }
      });

      logger.warn(`Customer ${customerId} has been banned. Reason: ${reason || 'Not specified'}`);
    } catch (error) {
      logger.error('Error banning customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to ban customer',
        { metadata: { customerId, reason } }
      );
    }
  }

  /**
   * Unban a customer
   */
  static async unbanCustomer(customerId: string): Promise<void> {
    try {
      await prisma.customer.update({
        where: { customerId },
        data: { 
          isBanned: false,
          updatedAt: new Date()
        }
      });

      logger.info(`Customer ${customerId} has been unbanned`);
    } catch (error) {
      logger.error('Error unbanning customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to unban customer',
        { metadata: { customerId } }
      );
    }
  }

  /**
   * Get customer with delivery info
   */
  static async getCustomerWithDeliveryInfo(customerId: string): Promise<any> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { customerId },
        include: {
          deliveryInfo: true
        }
      });

      if (!customer) {
        throw new BusinessLogicError(
          ErrorCode.ORDER_NOT_FOUND,
          'Customer not found',
          { metadata: { customerId } }
        );
      }

      return customer;
    } catch (error) {
      if (error instanceof BusinessLogicError) throw error;
      
      logger.error('Error getting customer with delivery info:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to get customer information',
        { metadata: { customerId } }
      );
    }
  }
}