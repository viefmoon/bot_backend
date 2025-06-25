import { prisma } from '../../server';
import { PaymentStatus } from '@prisma/client';
import logger from '../../common/utils/logger';
import { TechnicalError, ErrorCode } from '../../common/services/errors';

export class PaymentService {
  /**
   * Check if an order has been paid
   */
  static async isOrderPaid(orderId: string): Promise<boolean> {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          orderId,
          status: 'PAID',
          deletedAt: null
        }
      });
      
      return payments.length > 0;
    } catch (error) {
      logger.error('Error checking if order is paid:', error);
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Error checking payment status',
        { orderId, error: error as Error }
      );
    }
  }

  /**
   * Get payment status for an order
   */
  static async getOrderPaymentStatus(orderId: string): Promise<PaymentStatus | null> {
    try {
      const payment = await prisma.payment.findFirst({
        where: {
          orderId,
          deletedAt: null
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return payment?.status || null;
    } catch (error) {
      logger.error('Error getting order payment status:', error);
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Error retrieving payment status',
        { orderId, error: error as Error }
      );
    }
  }

  /**
   * Get all payments for an order
   */
  static async getOrderPayments(orderId: string) {
    try {
      return await prisma.payment.findMany({
        where: {
          orderId,
          deletedAt: null
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      logger.error('Error getting order payments:', error);
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Error retrieving payments for order',
        { orderId, error: error as Error }
      );
    }
  }

  /**
   * Calculate total paid amount for an order
   */
  static async getOrderPaidAmount(orderId: string): Promise<number> {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          orderId,
          status: 'PAID',
          deletedAt: null
        }
      });
      
      return payments.reduce((total, payment) => {
        return total + Number(payment.amount);
      }, 0);
    } catch (error) {
      logger.error('Error calculating paid amount:', error);
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Error calculating paid amount',
        { orderId, error: error as Error }
      );
    }
  }

  /**
   * Check if order has pending payment
   */
  static async hasOrderPendingPayment(orderId: string): Promise<boolean> {
    try {
      const payment = await prisma.payment.findFirst({
        where: {
          orderId,
          status: 'PENDING',
          deletedAt: null
        }
      });
      
      return !!payment;
    } catch (error) {
      logger.error('Error checking pending payments:', error);
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Error checking for pending payments',
        { orderId, error: error as Error }
      );
    }
  }
}