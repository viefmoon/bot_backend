import { prisma } from '../../server';
import { Prisma } from '@prisma/client';
import logger from '../../common/utils/logger';
import { Customer } from '../../common/types';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';
import { SyncMetadataService } from '../sync/SyncMetadataService';

/**
 * Service for managing customer-related operations
 */
export class CustomerService {
  /**
   * Check if a customer is banned by WhatsApp phone number
   */
  static async isCustomerBanned(whatsappPhoneNumber: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber },
        select: { isBanned: true }
      });
      
      return customer?.isBanned ?? false;
    } catch (error) {
      logger.error('Error checking if customer is banned:', error);
      return false;
    }
  }

  /**
   * Get customer by WhatsApp phone number
   */
  static async getCustomerByPhone(whatsappPhoneNumber: string): Promise<Customer | null> {
    try {
      return await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });
    } catch (error) {
      logger.error('Error getting customer by phone:', error);
      return null;
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      return await prisma.customer.findUnique({
        where: { id: customerId }
      });
    } catch (error) {
      logger.error('Error getting customer by ID:', error);
      return null;
    }
  }

  /**
   * Get or create a customer by WhatsApp phone number
   */
  static async getOrCreateCustomer(whatsappPhoneNumber: string): Promise<Customer> {
    try {
      let customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: { whatsappPhoneNumber }
        });
        logger.info(`Created new customer with phone: ${whatsappPhoneNumber}`);
        
        // Mark for sync
        await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      }

      return customer;
    } catch (error) {
      logger.error('Error getting or creating customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to get or create customer',
        { metadata: { whatsappPhoneNumber } }
      );
    }
  }

  /**
   * Update customer information by ID
   */
  static async updateCustomer(
    customerId: string, 
    data: Prisma.CustomerUpdateInput
  ): Promise<Customer> {
    try {
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data
      });

      logger.info(`Updated customer ${customerId}:`, data);
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      
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
   * Update customer information by WhatsApp phone number
   */
  static async updateCustomerByPhone(
    whatsappPhoneNumber: string, 
    data: Prisma.CustomerUpdateInput
  ): Promise<Customer> {
    try {
      const customer = await prisma.customer.update({
        where: { whatsappPhoneNumber },
        data
      });

      logger.info(`Updated customer with phone ${whatsappPhoneNumber}:`, data);
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      
      return customer;
    } catch (error) {
      logger.error('Error updating customer by phone:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to update customer',
        { metadata: { whatsappPhoneNumber, data } }
      );
    }
  }

  /**
   * Ban a customer by WhatsApp phone number
   */
  static async banCustomer(whatsappPhoneNumber: string, reason?: string): Promise<void> {
    try {
      const customer = await prisma.customer.update({
        where: { whatsappPhoneNumber },
        data: { 
          isBanned: true,
          bannedAt: new Date(),
          banReason: reason,
          updatedAt: new Date()
        }
      });

      logger.warn(`Customer with phone ${whatsappPhoneNumber} has been banned. Reason: ${reason || 'Not specified'}`);
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    } catch (error) {
      logger.error('Error banning customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to ban customer',
        { metadata: { whatsappPhoneNumber, reason } }
      );
    }
  }

  /**
   * Unban a customer by WhatsApp phone number
   */
  static async unbanCustomer(whatsappPhoneNumber: string): Promise<void> {
    try {
      const customer = await prisma.customer.update({
        where: { whatsappPhoneNumber },
        data: { 
          isBanned: false,
          bannedAt: null,
          banReason: null,
          updatedAt: new Date()
        }
      });

      logger.info(`Customer with phone ${whatsappPhoneNumber} has been unbanned`);
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    } catch (error) {
      logger.error('Error unbanning customer:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to unban customer',
        { metadata: { whatsappPhoneNumber } }
      );
    }
  }

  /**
   * Get customer with delivery info by WhatsApp phone number
   */
  static async getCustomerWithDeliveryInfo(whatsappPhoneNumber: string): Promise<any> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber },
        include: {
          addresses: true
        }
      });

      if (!customer) {
        throw new BusinessLogicError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Customer not found',
          { metadata: { whatsappPhoneNumber } }
        );
      }

      return customer;
    } catch (error) {
      if (error instanceof BusinessLogicError) throw error;
      
      logger.error('Error getting customer with delivery info:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to get customer information',
        { metadata: { whatsappPhoneNumber } }
      );
    }
  }

  /**
   * Get customer with delivery info by ID
   */
  static async getCustomerWithDeliveryInfoById(customerId: string): Promise<any> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: true
        }
      });

      if (!customer) {
        throw new BusinessLogicError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Customer not found',
          { metadata: { customerId } }
        );
      }

      return customer;
    } catch (error) {
      if (error instanceof BusinessLogicError) throw error;
      
      logger.error('Error getting customer with delivery info by ID:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to get customer information',
        { metadata: { customerId } }
      );
    }
  }
}