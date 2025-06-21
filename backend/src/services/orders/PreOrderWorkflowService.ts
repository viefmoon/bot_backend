import { randomUUID } from 'crypto';
import { prisma } from '../../server';
import { redisService } from '../redis/RedisService';
import { PreOrderService } from './PreOrderService';
import { OrderManagementService } from './services/OrderManagementService';
import { sendWhatsAppMessage, WhatsAppService } from '../whatsapp';
import { generateOrderSummary } from '../../whatsapp/handlers/orders/orderFormatters';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';
import logger from '../../common/utils/logger';
import {
  ProcessedOrderData,
  PreOrderWorkflowResult,
  PreOrderActionParams,
  PreOrderSummary,
  TokenValidationResult
} from '../../common/types/preorder.types';

/**
 * Centralized service for handling the complete PreOrder workflow
 * Manages creation, notification, and action processing with secure tokens
 */
export class PreOrderWorkflowService {
  private static readonly TOKEN_PREFIX = 'preorder:token:';
  private static readonly TOKEN_TTL_SECONDS = 600; // 10 minutes
  
  /**
   * Creates a preorder and sends confirmation to the customer
   */
  static async createAndNotify(params: {
    orderData: ProcessedOrderData;
    customerId: string;
    whatsappNumber: string;
  }): Promise<PreOrderWorkflowResult> {
    try {
      logger.info('Creating preorder with workflow', { 
        customerId: params.customerId,
        orderType: params.orderData.orderType 
      });
      
      // 1. Create preorder using existing service
      const preOrderService = new PreOrderService();
      const preOrderResult = await preOrderService.createPreOrder({
        orderItems: params.orderData.orderItems,
        orderType: params.orderData.orderType,
        scheduledAt: params.orderData.scheduledAt || undefined,
        whatsappPhoneNumber: params.whatsappNumber,
      });
      
      // 2. Generate unique token for actions
      const actionToken = await this.generateActionToken(preOrderResult.preOrderId);
      const expiresAt = new Date(Date.now() + this.TOKEN_TTL_SECONDS * 1000);
      
      // 3. Send order summary to customer
      await this.sendOrderSummary(params.whatsappNumber, preOrderResult);
      
      // 4. Send action buttons with token
      const messageId = await this.sendActionButtons(
        params.whatsappNumber, 
        actionToken,
        preOrderResult.preOrderId
      );
      
      // 5. Update preorder with messageId for tracking
      await prisma.preOrder.update({
        where: { id: preOrderResult.preOrderId },
        data: { messageId }
      });
      
      logger.info('PreOrder workflow completed', { 
        preOrderId: preOrderResult.preOrderId,
        token: actionToken.substring(0, 8) + '...' 
      });
      
      return { 
        preOrderId: preOrderResult.preOrderId, 
        actionToken,
        expiresAt 
      };
    } catch (error) {
      logger.error('Error in preorder workflow', error);
      throw error;
    }
  }
  
  /**
   * Processes customer action on the preorder
   */
  static async processAction(params: PreOrderActionParams): Promise<void> {
    try {
      logger.info('Processing preorder action', { 
        action: params.action,
        token: params.token.substring(0, 8) + '...' 
      });
      
      // 1. Validate and decode token
      const validation = await this.validateActionToken(params.token);
      if (!validation.isValid || !validation.preOrderId) {
        throw new BusinessLogicError(
          ErrorCode.INVALID_TOKEN,
          validation.error || 'Token inválido o expirado'
        );
      }
      
      // 2. Execute action
      if (params.action === 'confirm') {
        await this.confirmPreOrder(validation.preOrderId, params.whatsappNumber);
      } else {
        await this.discardPreOrder(validation.preOrderId, params.whatsappNumber);
      }
      
      // 3. Clean up token after use
      await this.deleteActionToken(params.token);
      
    } catch (error) {
      logger.error('Error processing preorder action', error);
      throw error;
    }
  }
  
  /**
   * Generates a secure action token for the preorder
   */
  private static async generateActionToken(preOrderId: number): Promise<string> {
    const token = randomUUID();
    const key = `${this.TOKEN_PREFIX}${token}`;
    
    // Store in Redis with TTL
    await redisService.set(key, preOrderId.toString(), this.TOKEN_TTL_SECONDS);
    
    logger.debug('Generated action token', { 
      preOrderId, 
      token: token.substring(0, 8) + '...' 
    });
    
    return token;
  }
  
  /**
   * Validates an action token and returns the associated preOrderId
   */
  private static async validateActionToken(token: string): Promise<TokenValidationResult> {
    const key = `${this.TOKEN_PREFIX}${token}`;
    
    try {
      const preOrderIdStr = await redisService.get(key);
      
      if (!preOrderIdStr) {
        return { 
          isValid: false, 
          error: 'Token no encontrado o expirado' 
        };
      }
      
      const preOrderId = parseInt(preOrderIdStr, 10);
      
      // Verify preorder still exists
      const preOrder = await prisma.preOrder.findUnique({
        where: { id: preOrderId }
      });
      
      if (!preOrder) {
        return { 
          isValid: false, 
          error: 'PreOrden no encontrada' 
        };
      }
      
      return { 
        isValid: true, 
        preOrderId 
      };
      
    } catch (error) {
      logger.error('Error validating token', error);
      return { 
        isValid: false, 
        error: 'Error al validar token' 
      };
    }
  }
  
  /**
   * Deletes an action token
   */
  private static async deleteActionToken(token: string): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${token}`;
    await redisService.del(key);
  }
  
  /**
   * Sends order summary to the customer
   */
  private static async sendOrderSummary(
    whatsappNumber: string, 
    preOrderResult: any
  ): Promise<void> {
    const orderSummary = generateOrderSummary(preOrderResult);
    await sendWhatsAppMessage(whatsappNumber, orderSummary);
  }
  
  /**
   * Sends action buttons to the customer
   */
  private static async sendActionButtons(
    whatsappNumber: string, 
    token: string,
    preOrderId: number
  ): Promise<string> {
    const message = {
      type: "button",
      body: {
        text: "¿Deseas confirmar tu pedido?"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `preorder_confirm:${token}`,
              title: "✅ Confirmar"
            }
          },
          {
            type: "reply",
            reply: {
              id: `preorder_discard:${token}`,
              title: "❌ Cancelar"
            }
          }
        ]
      }
    };
    
    // Generate a unique message ID for tracking
    const messageId = `preorder_${preOrderId}_${Date.now()}`;
    
    await WhatsAppService.sendInteractiveMessage(
      whatsappNumber, 
      message, 
      messageId
    );
    
    return messageId;
  }
  
  /**
   * Confirms a preorder and converts it to an order
   */
  private static async confirmPreOrder(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Confirming preorder', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    // Convert preorder to order
    const order = await orderManagementService.confirmPreOrder(preOrderId);
    
    logger.info('Order created successfully', { 
      orderId: order.id,
      dailyNumber: order.dailyNumber 
    });
    
    // Send confirmation using OrderManagementService
    await orderManagementService.sendOrderConfirmation(whatsappNumber, order.id, 'confirmed');
  }
  
  /**
   * Discards a preorder
   */
  private static async discardPreOrder(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Discarding preorder', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    // Delete the preorder
    await orderManagementService.discardPreOrder(preOrderId);
    
    // Send cancellation message
    await sendWhatsAppMessage(
      whatsappNumber,
      "❌ Tu pedido ha sido cancelado. Si deseas realizar un nuevo pedido, puedes hacerlo cuando gustes. 🍕"
    );
  }
}