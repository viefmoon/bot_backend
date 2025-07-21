/**
 * Pre-order related interactive message handlers
 */
import { PreOrderWorkflowService } from '../../../services/orders/PreOrderWorkflowService';
import { startsWithAction, INTERACTIVE_ACTIONS, extractIdFromAction } from '../../../common/constants/interactiveActions';
import { prisma } from '../../../lib/prisma';
import { redisService } from '../../../services/redis/RedisService';
import { OTPService } from '../../../services/security/OTPService';
import { WhatsAppService, sendMessageWithUrlButton } from '../../../services/whatsapp';
import { env } from '../../../common/config/envValidator';
import { BusinessLogicError, ErrorCode, ValidationError } from '../../../common/services/errors';
import { redisKeys } from '../../../common/constants';
import { formatAddressShort, formatAddressDescription } from '../../../common/utils/addressFormatter';
import logger from '../../../common/utils/logger';
import { UnifiedResponse, ResponseBuilder } from '../../../services/messaging/types';
import { MessageContext } from '../../../services/messaging/MessageContext';
import { LinkGenerationService } from '../../../services/security/LinkGenerationService';
import { OrderType } from '@prisma/client';

/**
 * Handles preorder actions (confirm/discard) using the token-based system
 */
export async function handlePreOrderAction(from: string, buttonId: string, context?: MessageContext): Promise<UnifiedResponse> {
  // Extract token from button ID
  // Format: preorder_confirm:token or preorder_discard:token
  const parts = buttonId.split(':');
  const token = parts[1];
  
  if (!token) {
    throw new BusinessLogicError(
      ErrorCode.INVALID_TOKEN,
      'Invalid button format - missing token'
    );
  }
    
    // Determine action based on button prefix
    const action: 'confirm' | 'discard' = 
      startsWithAction(buttonId, INTERACTIVE_ACTIONS.PREORDER_CONFIRM) ? 'confirm' : 'discard';
    
    logger.info('Processing preorder action', { 
      from, 
      action, 
      tokenPrefix: token.substring(0, 8) + '...' 
    });
    
    try {
      // Process the action using the workflow service
      await PreOrderWorkflowService.processAction({
        action,
        token,
        whatsappNumber: from
      }, context);
      
      // Return empty response since the workflow service handles sending messages
      return ResponseBuilder.empty();
    } catch (error) {
      // Handle expired token or other errors
      if (error instanceof BusinessLogicError && error.code === ErrorCode.INVALID_TOKEN) {
        logger.warn('Invalid or expired preorder token', { token: token.substring(0, 8) + '...' });
        return ResponseBuilder.text(
          '⚠️ Esta pre-orden ya no está disponible. Solo puedes confirmar o cancelar la pre-orden más reciente.',
          true
        );
      }
      // Re-throw other errors
      throw error;
    }
}

/**
 * Handles preorder change order type action
 * Shows all available options: all addresses + pickup option
 */
export async function handlePreOrderChangeType(from: string, buttonId: string, context?: MessageContext): Promise<UnifiedResponse> {
  // Extract token from button ID
  const parts = buttonId.split(':');
  const token = parts[1];
  
  if (!token) {
    throw new BusinessLogicError(
      ErrorCode.INVALID_TOKEN,
      'Invalid button format - missing token'
    );
  }
  
  // Validate token and get preOrderId
  const key = redisKeys.preorderToken(token);
  const preOrderIdStr = await redisService.get(key);
  
  if (!preOrderIdStr) {
    logger.warn('Invalid or expired preorder token for change type', { token: token.substring(0, 8) + '...' });
    return ResponseBuilder.text(
      '⚠️ Esta pre-orden ya no está disponible. Solo puedes cambiar el tipo de la pre-orden más reciente.',
      true
    );
  }
  
  const preOrderId = parseInt(preOrderIdStr, 10);
  
  // Get the current preOrder with delivery info to know current selection
  const preOrder = await prisma.preOrder.findUnique({
    where: { id: preOrderId },
    select: { 
      orderType: true,
      deliveryInfo: true
    }
  });
  
  if (!preOrder) {
    throw new BusinessLogicError(
      ErrorCode.ORDER_NOT_FOUND,
      'Pre-order not found'
    );
  }
  
  // Get customer with addresses
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber: from },
    include: {
      addresses: {
        where: { deletedAt: null },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5
      }
    }
  });
  
  if (!customer) {
    throw new BusinessLogicError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found'
    );
  }
  
  // Build rows for the list
  const rows = [];
  
  // Add pickup option if not currently selected
  if (preOrder.orderType !== 'TAKE_AWAY') {
    rows.push({
      id: `select_order_type:${preOrderId}:TAKE_AWAY`,
      title: "🏠 Recoger en tienda",
      description: "Recoger mi pedido en el restaurante"
    });
  }
  
  // Add all addresses except the currently selected one
  for (const address of customer.addresses) {
    // Skip if this is the currently selected address for delivery
    // Note: We can't skip based on address since DeliveryInfo doesn't have addressId
    // This is a limitation - user might see their current address in the list
    
    rows.push({
      id: `select_order_type:${preOrderId}:DELIVERY:${address.id}`,
      title: `🚚 ${address.name || `${address.street} ${address.number}`.substring(0, 24)}`,
      description: formatAddressDescription(address).substring(0, 72)
    });
  }
  
  // Add option for new address if customer has less than 5
  if (customer.addresses.length < 5) {
    rows.push({
      id: `add_new_address_preorder:${preOrderId}`,
      title: "➕ Nueva dirección",
      description: "Registrar una nueva dirección de entrega"
    });
  }
  
  // If no options available (shouldn't happen but just in case)
  if (rows.length === 0) {
    return ResponseBuilder.text(
      "No hay otras opciones disponibles para tu pedido.",
      true
    );
  }
  
  const sections = [{
    title: "Opciones de entrega",
    rows: rows
  }];
  
  // Determine current selection text
  let currentSelection = "";
  if (preOrder.orderType === 'TAKE_AWAY') {
    currentSelection = "Tu pedido actual es para *recoger en tienda*.";
  } else {
    currentSelection = "Tu pedido actual es para *entrega a domicilio*.";
  }
  
  return ResponseBuilder.interactive({
    type: "list",
    header: {
      type: "text",
      text: "🔄 Cambiar tipo de pedido"
    },
    body: {
      text: `${currentSelection}\n\nSelecciona cómo prefieres recibir tu pedido:`
    },
    footer: {
      text: "Elige una opción"
    },
    action: {
      button: "Ver opciones",
      sections
    }
  });
}


/**
 * Handles selection of order type from the list
 * Format: select_order_type:preOrderId:orderType[:addressId]
 */
export async function handleSelectOrderType(from: string, buttonId: string, context?: MessageContext): Promise<UnifiedResponse> {
  // Extract parts from button ID
  const parts = buttonId.split(':');
  const preOrderId = parseInt(parts[1], 10);
  const newOrderType = parts[2] as OrderType;
  const addressId = parts[3]; // Optional, only for DELIVERY
  
  if (!preOrderId || !newOrderType) {
    throw new BusinessLogicError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Invalid button format'
    );
  }
  
  // Import PreOrderWorkflowService dynamically to avoid circular dependency
  const { PreOrderWorkflowService } = await import('../../../services/orders/PreOrderWorkflowService');
  
  if (newOrderType === 'TAKE_AWAY') {
    // Change to pickup
    await PreOrderWorkflowService.recreatePreOrderWithNewType({
      oldPreOrderId: preOrderId,
      newOrderType: OrderType.TAKE_AWAY,
      whatsappNumber: from
    });
  } else if (newOrderType === 'DELIVERY' && addressId) {
    // Change to delivery with specific address
    await PreOrderWorkflowService.recreatePreOrderWithNewAddress({
      oldPreOrderId: preOrderId,
      newAddressId: addressId,
      whatsappNumber: from
    });
  } else {
    throw new BusinessLogicError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Invalid order type selection'
    );
  }
  
  // Return empty response as the workflow will send its own messages
  return ResponseBuilder.empty();
}

