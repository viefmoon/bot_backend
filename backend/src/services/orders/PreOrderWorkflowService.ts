import { randomUUID } from 'crypto';
import { prisma } from '../../server';
import { redisService } from '../redis/RedisService';
import { PreOrderService } from './PreOrderService';
import { OrderManagementService } from './services/OrderManagementService';
import { sendWhatsAppMessage, WhatsAppService } from '../whatsapp';
import { generateOrderSummary } from '../../whatsapp/handlers/orders/orderFormatters';
import { BusinessLogicError, ErrorCode, ValidationError } from '../../common/services/errors';
import logger from '../../common/utils/logger';
import { SyncMetadataService } from '../sync/SyncMetadataService';
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
  private static readonly PREORDER_EXPIRY_MINUTES = 10; // Same as token TTL
  
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
      
      // Validate that there are items in the order
      if (!params.orderData.orderItems || params.orderData.orderItems.length === 0) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'No se puede crear una orden sin productos',
          {
            metadata: {
              validationFailure: 'EMPTY_ORDER',
              message: 'Debes agregar al menos un producto a tu pedido'
            }
          }
        );
      }
      
      // 1. Clean up any expired preorders from all users
      await this.cleanupExpiredPreOrders();
      
      // 2. Discard any active preorders for this user
      await this.discardActivePreOrders(params.whatsappNumber);
      
      // 3. Create preorder using existing service
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
      
      // 3. Send order summary with action buttons in a single message
      const messageId = await this.sendOrderSummaryWithButtons(
        params.whatsappNumber, 
        preOrderResult,
        actionToken,
        preOrderResult.preOrderId
      );
      
      // 4. Update chat history with preorder information
      await this.updateChatHistoryWithPreOrder(params.whatsappNumber, preOrderResult);
      
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
        // Don't send messages here - let the error handler do it
        // The error message will be sent by ErrorService.handleAndSendError
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
        // The preorder was deleted (likely because a new one was created)
        return { 
          isValid: false, 
          error: 'Esta preorden ya no está disponible. Por favor, realiza un nuevo pedido.' 
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
   * Sends order summary with action buttons in a single interactive message
   */
  private static async sendOrderSummaryWithButtons(
    whatsappNumber: string, 
    preOrderResult: any,
    token: string,
    preOrderId: number
  ): Promise<string> {
    // Generate the order summary text
    let orderSummary = generateOrderSummary(preOrderResult);
    
    // WhatsApp button messages have a 1024 character limit for the body
    const MAX_BODY_LENGTH = 1000; // Leave some margin
    if (orderSummary.length > MAX_BODY_LENGTH) {
      // Truncate and add indication that the message was truncated
      orderSummary = orderSummary.substring(0, MAX_BODY_LENGTH - 20) + '\n\n[...]';
      logger.warn(`Order summary truncated from ${orderSummary.length} to ${MAX_BODY_LENGTH} characters`);
    }
    
    // Create interactive message with summary and buttons
    const message = {
      type: "button",
      body: {
        text: orderSummary
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
   * Creates a sanitized version of the order summary for chat history
   * Removes sensitive information like prices
   */
  private static createHistoryMarker(preOrderResult: any): string {
    const orderType = preOrderResult.orderType === 'DELIVERY' ? 'entrega a domicilio' : 'recolección';
    
    let historyMessage = `📋 Resumen de pedido (${orderType}):\n`;
    
    // Agregar lista de productos sin precios
    if (preOrderResult.items && preOrderResult.items.length > 0) {
      historyMessage += 'Productos ordenados:\n';
      preOrderResult.items.forEach((item: any) => {
        const productName = item.product?.name || 'Producto';
        const variantName = item.productVariant?.name || '';
        const displayName = variantName || productName;
        const quantity = item.quantity || 1;
        
        historyMessage += `• ${quantity}x ${displayName}`;
        
        // Agregar modificadores sin precios
        if (item.modifiers && item.modifiers.length > 0) {
          const modifierNames = item.modifiers.map((mod: any) => mod.name).join(', ');
          historyMessage += ` (${modifierNames})`;
        }
        
        // Agregar personalizaciones de pizza
        if (item.pizzaCustomizations && item.pizzaCustomizations.length > 0) {
          const customNames = item.pizzaCustomizations
            .filter((cust: any) => cust.action === 'ADD')
            .map((cust: any) => cust.name)
            .join(', ');
          if (customNames) {
            historyMessage += ` - ${customNames}`;
          }
        }
        
        historyMessage += '\n';
      });
    }
    
    return historyMessage.trim();
  }
  
  /**
   * Updates chat history with preorder information
   */
  private static async updateChatHistoryWithPreOrder(
    whatsappNumber: string, 
    preOrderResult: any
  ): Promise<void> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber: whatsappNumber }
      });
      
      if (!customer) {
        logger.warn('Customer not found for chat history update');
        return;
      }
      
      // Obtener historial actual - manejar tanto string como array
      let fullChatHistory = [];
      let relevantChatHistory = [];
      
      try {
        if (customer.fullChatHistory) {
          fullChatHistory = typeof customer.fullChatHistory === 'string' 
            ? JSON.parse(customer.fullChatHistory) 
            : customer.fullChatHistory;
        }
        if (customer.relevantChatHistory) {
          relevantChatHistory = typeof customer.relevantChatHistory === 'string'
            ? JSON.parse(customer.relevantChatHistory)
            : customer.relevantChatHistory;
        }
      } catch (parseError) {
        logger.warn('Error parsing chat history, using empty arrays', parseError);
        fullChatHistory = [];
        relevantChatHistory = [];
      }
      
      // Crear mensaje sanitizado para el historial
      const historyMarker = this.createHistoryMarker(preOrderResult);
      
      // Agregar al historial completo (con toda la información)
      const fullMessage = generateOrderSummary(preOrderResult);
      fullChatHistory.push({
        role: 'assistant',
        content: fullMessage,
        timestamp: new Date()
      });
      
      // Agregar al historial relevante (sin información sensible)
      relevantChatHistory.push({
        role: 'assistant',
        content: historyMarker,
        timestamp: new Date()
      });
      
      // Limitar historial relevante a 20 mensajes
      const limitedRelevantHistory = relevantChatHistory.slice(-20);
      
      // Actualizar en la base de datos
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          fullChatHistory: JSON.stringify(fullChatHistory),
          relevantChatHistory: JSON.stringify(limitedRelevantHistory),
          lastInteraction: new Date()
        }
      });
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      
      logger.info('Chat history updated with preorder information');
    } catch (error) {
      logger.error('Error updating chat history with preorder:', error);
      // No lanzar error para no interrumpir el flujo de preorden
    }
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
   * Discards a preorder and clears relevant chat history
   */
  private static async discardPreOrder(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Discarding preorder and clearing history', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    // Delete the preorder
    await orderManagementService.discardPreOrder(preOrderId);
    
    // Clear relevant chat history for the customer
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: whatsappNumber }
    });
    
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          relevantChatHistory: [],
          updatedAt: new Date()
        }
      });
      logger.info(`Cleared relevant chat history for customer ${customer.id}`);
    }
    
    // Send cancellation message with instructions
    await sendWhatsAppMessage(
      whatsappNumber,
      "❌ Tu pedido ha sido cancelado y tu historial de conversación ha sido reiniciado.\n\n" +
      "🍕 Puedes comenzar un nuevo pedido desde cero cuando gustes.\n\n" +
      "💡 *Tip:* Para hacer un pedido, simplemente escribe lo que deseas ordenar e indica si es para entrega a domicilio o recolección en el restaurante."
    );
  }
  
  /**
   * Discard all active preorders for a user
   */
  private static async discardActivePreOrders(whatsappNumber: string): Promise<void> {
    try {
      // Find all active preorders for this phone number
      const activePreOrders = await prisma.preOrder.findMany({
        where: { whatsappPhoneNumber: whatsappNumber }
      });
      
      if (activePreOrders.length === 0) {
        return;
      }
      
      logger.info(`Found ${activePreOrders.length} active preorders for ${whatsappNumber}. Discarding them.`);
      
      // Delete all associated tokens from Redis
      const tokenKeys = await redisService.keys(`${this.TOKEN_PREFIX}*`);
      for (const key of tokenKeys) {
        const preOrderIdStr = await redisService.get(key);
        if (preOrderIdStr) {
          const preOrderId = parseInt(preOrderIdStr, 10);
          if (activePreOrders.some(po => po.id === preOrderId)) {
            await redisService.del(key);
            logger.debug(`Deleted token for preorder ${preOrderId}`);
          }
        }
      }
      
      // Delete all preorders
      await prisma.preOrder.deleteMany({
        where: { whatsappPhoneNumber: whatsappNumber }
      });
      
      logger.info(`Discarded ${activePreOrders.length} preorders for ${whatsappNumber}`);
    } catch (error) {
      logger.error('Error discarding active preorders', error);
      // Don't throw - this shouldn't prevent creating a new preorder
    }
  }
  
  /**
   * Clean up expired preorders (called periodically or before creating new ones)
   */
  static async cleanupExpiredPreOrders(): Promise<void> {
    try {
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() - this.PREORDER_EXPIRY_MINUTES);
      
      // Find all expired preorders
      const expiredPreOrders = await prisma.preOrder.findMany({
        where: {
          createdAt: {
            lt: expiryDate
          }
        }
      });
      
      if (expiredPreOrders.length === 0) {
        return;
      }
      
      logger.info(`Found ${expiredPreOrders.length} expired preorders to clean up`);
      
      // Delete associated tokens from Redis
      const tokenKeys = await redisService.keys(`${this.TOKEN_PREFIX}*`);
      for (const key of tokenKeys) {
        const preOrderIdStr = await redisService.get(key);
        if (preOrderIdStr) {
          const preOrderId = parseInt(preOrderIdStr, 10);
          if (expiredPreOrders.some(po => po.id === preOrderId)) {
            await redisService.del(key);
            logger.debug(`Deleted expired token for preorder ${preOrderId}`);
          }
        }
      }
      
      // Delete expired preorders
      const result = await prisma.preOrder.deleteMany({
        where: {
          createdAt: {
            lt: expiryDate
          }
        }
      });
      
      logger.info(`Cleaned up ${result.count} expired preorders`);
    } catch (error) {
      logger.error('Error cleaning up expired preorders', error);
    }
  }
}