import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
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

export class PreOrderWorkflowService {
  private static readonly TOKEN_PREFIX = 'preorder:token:';
  private static readonly TOKEN_TTL_SECONDS = 600; // 10 minutes
  private static readonly PREORDER_EXPIRY_MINUTES = 10; // Same as token TTL
  
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
      
      await this.cleanupExpiredPreOrders();
      
      await this.discardActivePreOrders(params.whatsappNumber);
      
      const preOrderService = new PreOrderService();
      const preOrderResult = await preOrderService.createPreOrder({
        orderItems: params.orderData.orderItems,
        orderType: params.orderData.orderType,
        scheduledAt: params.orderData.scheduledAt || undefined,
        whatsappPhoneNumber: params.whatsappNumber,
      });
      
      const actionToken = await this.generateActionToken(preOrderResult.preOrderId);
      const expiresAt = new Date(Date.now() + this.TOKEN_TTL_SECONDS * 1000);
      
      const messageId = await this.sendOrderSummaryWithButtons(
        params.whatsappNumber, 
        preOrderResult,
        actionToken,
        preOrderResult.preOrderId
      );
      
      await this.updateChatHistoryWithPreOrder(params.whatsappNumber, preOrderResult);
      
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
  
  static async processAction(params: PreOrderActionParams): Promise<void> {
    logger.info('Processing preorder action', { 
      action: params.action,
      token: params.token.substring(0, 8) + '...' 
    });
    
    const validation = await this.validateActionToken(params.token);
    if (!validation.isValid || !validation.preOrderId) {
      // Don't send messages here - let the error handler do it
      // The error will be caught and handled by the WhatsApp handler
      throw new BusinessLogicError(
        ErrorCode.INVALID_TOKEN,
        validation.error || 'Token inválido o expirado'
      );
    }
    
    if (params.action === 'confirm') {
      await this.confirmPreOrder(validation.preOrderId, params.whatsappNumber);
    } else {
      await this.discardPreOrder(validation.preOrderId, params.whatsappNumber);
    }
    
    await this.deleteActionToken(params.token);
  }
  
  private static async generateActionToken(preOrderId: number): Promise<string> {
    const token = randomUUID();
    const key = `${this.TOKEN_PREFIX}${token}`;
    
    await redisService.set(key, preOrderId.toString(), this.TOKEN_TTL_SECONDS);
    
    logger.debug('Generated action token', { 
      preOrderId, 
      token: token.substring(0, 8) + '...' 
    });
    
    return token;
  }
  
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
      
      const preOrder = await prisma.preOrder.findUnique({
        where: { id: preOrderId }
      });
      
      if (!preOrder) {
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
  
  private static async deleteActionToken(token: string): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${token}`;
    await redisService.del(key);
  }
  
  private static async sendOrderSummaryWithButtons(
    whatsappNumber: string, 
    preOrderResult: any,
    token: string,
    preOrderId: number
  ): Promise<string> {
    let orderSummary = generateOrderSummary(preOrderResult);
    
    // WhatsApp button messages have a 1024 character limit for the body
    const MAX_BODY_LENGTH = 1000; // Leave some margin
    if (orderSummary.length > MAX_BODY_LENGTH) {
      // Truncate and add indication that the message was truncated
      orderSummary = orderSummary.substring(0, MAX_BODY_LENGTH - 20) + '\n\n[...]';
      logger.warn(`Order summary truncated from ${orderSummary.length} to ${MAX_BODY_LENGTH} characters`);
    }
    
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
      
      const historyMarker = this.createHistoryMarker(preOrderResult);
      
      const fullMessage = generateOrderSummary(preOrderResult);
      fullChatHistory.push({
        role: 'assistant',
        content: fullMessage,
        timestamp: new Date()
      });
      
      relevantChatHistory.push({
        role: 'assistant',
        content: historyMarker,
        timestamp: new Date()
      });
      
      // Limitar historial relevante a 20 mensajes
      const limitedRelevantHistory = relevantChatHistory.slice(-20);
      
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          fullChatHistory: JSON.stringify(fullChatHistory),
          relevantChatHistory: JSON.stringify(limitedRelevantHistory),
          lastInteraction: new Date()
        }
      });
      
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      
      logger.info('Chat history updated with preorder information');
    } catch (error) {
      logger.error('Error updating chat history with preorder:', error);
      // No lanzar error para no interrumpir el flujo de preorden
    }
  }
  
  private static async confirmPreOrder(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Confirming preorder', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    const order = await orderManagementService.confirmPreOrder(preOrderId);
    
    logger.info('Order created successfully', { 
      orderId: order.id,
      dailyNumber: order.dailyNumber 
    });
    
    await orderManagementService.sendOrderConfirmation(whatsappNumber, order.id, 'confirmed');
  }
  
  private static async discardPreOrder(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Discarding preorder and clearing history', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    await orderManagementService.discardPreOrder(preOrderId);
    
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
    
    await sendWhatsAppMessage(
      whatsappNumber,
      "❌ Tu pedido ha sido cancelado y tu historial de conversación ha sido reiniciado.\n\n" +
      "🍕 Puedes comenzar un nuevo pedido desde cero cuando gustes.\n\n" +
      "💡 *Tip:* Para hacer un pedido, simplemente escribe lo que deseas ordenar e indica si es para entrega a domicilio o recolección en el restaurante."
    );
  }
  
  private static async discardActivePreOrders(whatsappNumber: string): Promise<void> {
    try {
      const activePreOrders = await prisma.preOrder.findMany({
        where: { whatsappPhoneNumber: whatsappNumber }
      });
      
      if (activePreOrders.length === 0) {
        return;
      }
      
      logger.info(`Found ${activePreOrders.length} active preorders for ${whatsappNumber}. Discarding them.`);
      
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
      
      await prisma.preOrder.deleteMany({
        where: { whatsappPhoneNumber: whatsappNumber }
      });
      
      logger.info(`Discarded ${activePreOrders.length} preorders for ${whatsappNumber}`);
    } catch (error) {
      logger.error('Error discarding active preorders', error);
      // Don't throw - this shouldn't prevent creating a new preorder
    }
  }
  
  static async cleanupExpiredPreOrders(): Promise<void> {
    try {
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() - this.PREORDER_EXPIRY_MINUTES);
      
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