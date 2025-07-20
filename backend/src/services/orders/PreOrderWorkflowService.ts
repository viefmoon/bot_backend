import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { OrderType, CustomizationAction } from '@prisma/client';
import { redisService } from '../redis/RedisService';
import { PreOrderService } from './PreOrderService';
import { OrderManagementService } from './services/OrderManagementService';
import { sendWhatsAppMessage, WhatsAppService } from '../whatsapp';
import { generateOrderSummary } from '../../whatsapp/handlers/orders/orderFormatters';
import { BusinessLogicError, ErrorCode, ValidationError } from '../../common/services/errors';
import { redisKeys, REDIS_KEYS, CONTEXT_KEYS } from '../../common/constants';
import logger from '../../common/utils/logger';
import { SyncMetadataService } from '../sync/SyncMetadataService';
import { MessageContext } from '../messaging/MessageContext';
import {
  ProcessedOrderData,
  PreOrderWorkflowResult,
  PreOrderActionParams,
  TokenValidationResult
} from '../../common/types/preorder.types';

export class PreOrderWorkflowService {
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
        deliveryInfo: params.orderData.deliveryInfo,
      });
      
      const actionToken = await this.generateActionToken(preOrderResult.preOrderId);
      const expiresAt = new Date(Date.now() + this.TOKEN_TTL_SECONDS * 1000);
      
      await this.sendOrderSummaryWithButtons(
        params.whatsappNumber, 
        preOrderResult,
        actionToken
      );
      
      await this.updateChatHistoryWithPreOrder(params.whatsappNumber, preOrderResult);
      
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
  
  static async processAction(params: PreOrderActionParams, context?: MessageContext): Promise<void> {
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
      await this.confirmPreOrder(validation.preOrderId, params.whatsappNumber, context);
    } else {
      // Use the method that includes user interaction
      await this.discardPreOrderAndResetConversation(validation.preOrderId, params.whatsappNumber);
    }
    
    await this.deleteActionToken(params.token);
  }
  
  private static async generateActionToken(preOrderId: number): Promise<string> {
    const token = randomUUID();
    const key = redisKeys.preorderToken(token);
    
    await redisService.set(key, preOrderId.toString(), this.TOKEN_TTL_SECONDS);
    
    logger.debug('Generated action token', { 
      preOrderId, 
      token: token.substring(0, 8) + '...' 
    });
    
    return token;
  }
  
  private static async validateActionToken(token: string): Promise<TokenValidationResult> {
    const key = redisKeys.preorderToken(token);
    
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
    const key = redisKeys.preorderToken(token);
    await redisService.del(key);
  }
  
  static async sendOrderSummaryWithButtons(
    whatsappNumber: string, 
    preOrderResult: any,
    token: string
  ): Promise<void> {
    let orderSummary = generateOrderSummary(preOrderResult);
    
    // WhatsApp button messages have a 1024 character limit for the body
    const MAX_BODY_LENGTH = 1000; // Leave some margin
    if (orderSummary.length > MAX_BODY_LENGTH) {
      // Truncate and add indication that the message was truncated
      orderSummary = orderSummary.substring(0, MAX_BODY_LENGTH - 20) + '\n\n[...]';
      logger.warn(`Order summary truncated from ${orderSummary.length} to ${MAX_BODY_LENGTH} characters`);
    }
    
    // Build buttons array
    const buttons = [
      {
        type: "reply",
        reply: {
          id: `preorder_confirm:${token}`,
          title: "✅ Confirmar"
        }
      }
    ];
    
    // Add change address button only for delivery orders
    if (preOrderResult.orderType === OrderType.DELIVERY) {
      buttons.push({
        type: "reply",
        reply: {
          id: `preorder_change_address:${token}`,
          title: "📍 Cambiar dirección"
        }
      });
    }
    
    buttons.push({
      type: "reply",
      reply: {
        id: `preorder_discard:${token}`,
        title: "❌ Cancelar"
      }
    });
    
    const message = {
      type: "button",
      body: {
        text: orderSummary
      },
      action: {
        buttons: buttons
      }
    };
    
    await WhatsAppService.sendInteractiveMessage(
      whatsappNumber, 
      message
    );
  }
  
  /**
   * Creates a sanitized version of the order summary for chat history
   * Removes sensitive information like prices
   */
  private static createHistoryMarker(preOrderResult: any): string {
    const orderType = preOrderResult.orderType === OrderType.DELIVERY ? 'entrega a domicilio' : 'recolección';
    
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
            .filter((cust: any) => cust.action === CustomizationAction.ADD)
            .map((cust: any) => cust.name)
            .join(', ');
          if (customNames) {
            historyMessage += ` - ${customNames}`;
          }
        }
        
        historyMessage += '\n';
      });
    }
    
    historyMessage += '\n(Puedes seguir agregando o modificando productos antes de confirmar)';
    
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
    whatsappNumber: string,
    context?: MessageContext
  ): Promise<void> {
    logger.info('Confirming preorder', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    
    const order = await orderManagementService.confirmPreOrder(preOrderId);
    
    logger.info('Order created successfully', { 
      orderId: order.id,
      shiftOrderNumber: order.shiftOrderNumber 
    });
    
    // Send order confirmation BEFORE clearing history
    await orderManagementService.sendOrderConfirmation(whatsappNumber, order.id);
    
    // Clear relevant chat history AFTER sending confirmation
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
      logger.info(`Cleared relevant chat history for customer ${customer.id} after order confirmation`);
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    }
    
    // Tell the pipeline to skip the final history update for this interaction
    if (context) {
      context.set(CONTEXT_KEYS.SKIP_HISTORY_UPDATE, true);
      logger.info(`Setting SKIP_HISTORY_UPDATE flag for customer ${whatsappNumber}`);
    }
  }
  
  /**
   * Discards a preorder and resets the conversation for the user
   * This includes clearing chat history and sending a notification
   */
  private static async discardPreOrderAndResetConversation(
    preOrderId: number, 
    whatsappNumber: string
  ): Promise<void> {
    logger.info('Discarding preorder and resetting conversation', { preOrderId });
    
    // 1. Discard the preorder data
    await this.discardPreOrderData(preOrderId);
    
    // 2. Clear chat history
    await this.clearCustomerChatHistory(whatsappNumber);
    
    // 3. Send reset notification to user
    await this.sendDiscardNotification(whatsappNumber);
  }
  
  /**
   * Only discards the preorder data without any side effects
   * Useful for silent cleanup operations
   */
  private static async discardPreOrderData(preOrderId: number): Promise<void> {
    logger.info('Discarding preorder data', { preOrderId });
    
    const orderManagementService = new OrderManagementService();
    await orderManagementService.discardPreOrder(preOrderId);
  }
  
  /**
   * Clears the customer's chat history
   */
  private static async clearCustomerChatHistory(whatsappNumber: string): Promise<void> {
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
  }
  
  /**
   * Sends a notification message after discarding a preorder
   */
  private static async sendDiscardNotification(whatsappNumber: string): Promise<void> {
    await sendWhatsAppMessage(
      whatsappNumber,
      "❌ Tu pedido ha sido descartado y tu historial de conversación ha sido reiniciado.\n\n" +
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
      
      const tokenKeys = await redisService.keys(`${REDIS_KEYS.PREORDER_TOKEN_PREFIX}*`);
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
      
      const tokenKeys = await redisService.keys(`${REDIS_KEYS.PREORDER_TOKEN_PREFIX}*`);
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
  
  /**
   * Recreate preOrder with new address
   * This is used when customer changes address during preorder flow
   */
  static async recreatePreOrderWithNewAddress(params: {
    oldPreOrderId: number;
    newAddressId: string;
    whatsappNumber: string;
  }): Promise<PreOrderWorkflowResult> {
    try {
      // Get the old preOrder with all details
      const oldPreOrder = await prisma.preOrder.findUnique({
        where: { id: params.oldPreOrderId },
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
              productModifiers: true,
              selectedPizzaCustomizations: {
                include: {
                  pizzaCustomization: true
                }
              }
            }
          }
        }
      });
      
      if (!oldPreOrder) {
        throw new BusinessLogicError(
          ErrorCode.ORDER_NOT_FOUND,
          'PreOrder not found',
          { metadata: { preOrderId: params.oldPreOrderId } }
        );
      }
      
      // Get the new address
      const newAddress = await prisma.address.findUnique({
        where: { id: params.newAddressId },
        include: { customer: true }
      });
      
      if (!newAddress) {
        throw new BusinessLogicError(
          ErrorCode.ADDRESS_NOT_FOUND,
          'Address not found',
          { metadata: { addressId: params.newAddressId } }
        );
      }
      
      // Prepare order data from old preOrder
      const orderData: ProcessedOrderData = {
        orderItems: oldPreOrder.orderItems.map(item => ({
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: 1,
          selectedModifiers: item.productModifiers.map(m => m.id),
          selectedPizzaCustomizations: item.selectedPizzaCustomizations.map(pc => ({
            pizzaCustomizationId: pc.pizzaCustomizationId,
            half: pc.half,
            action: pc.action
          }))
        })),
        orderType: oldPreOrder.orderType as 'DELIVERY' | 'TAKE_AWAY',
        scheduledAt: oldPreOrder.scheduledAt || undefined,
        deliveryInfo: {
          name: newAddress.name,
          street: newAddress.street,
          number: newAddress.number,
          interiorNumber: newAddress.interiorNumber,
          neighborhood: newAddress.neighborhood,
          city: newAddress.city,
          state: newAddress.state,
          zipCode: newAddress.zipCode,
          country: newAddress.country,
          deliveryInstructions: newAddress.deliveryInstructions,
          latitude: newAddress.latitude?.toNumber() || null,
          longitude: newAddress.longitude?.toNumber() || null
        }
      };
      
      // Mark that we're updating a preOrder to prevent welcome message
      const updateKey = redisKeys.preorderUpdating(params.whatsappNumber);
      await redisService.set(updateKey, 'true', 60); // 60 seconds TTL
      
      // Discard the old preOrder
      await this.discardPreOrderData(params.oldPreOrderId);
      
      // Delete old token
      const tokenKeys = await redisService.keys(`${REDIS_KEYS.PREORDER_TOKEN_PREFIX}*`);
      for (const key of tokenKeys) {
        const storedPreOrderId = await redisService.get(key);
        if (storedPreOrderId === params.oldPreOrderId.toString()) {
          await redisService.del(key);
          break;
        }
      }
      
      // Create new preOrder with new address
      const result = await this.createAndNotify({
        orderData,
        customerId: newAddress.customerId,
        whatsappNumber: params.whatsappNumber
      });
      
      // Clean up the update flag
      await redisService.del(updateKey);
      
      return result;
    } catch (error) {
      logger.error('Error recreating preOrder with new address', error);
      throw error;
    }
  }
}