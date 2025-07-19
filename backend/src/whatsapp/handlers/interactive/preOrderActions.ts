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
import { BusinessLogicError, ErrorCode } from '../../../common/services/errors';
import { redisKeys } from '../../../common/constants';
import { formatAddressShort, formatAddressDescription } from '../../../common/utils/addressFormatter';
import logger from '../../../common/utils/logger';
import { UnifiedResponse, ResponseBuilder } from '../../../services/messaging/types';

/**
 * Handles preorder actions (confirm/discard) using the token-based system
 */
export async function handlePreOrderAction(from: string, buttonId: string): Promise<UnifiedResponse> {
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
      });
      
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
 * Handles preorder change address action
 */
export async function handlePreOrderChangeAddress(from: string, buttonId: string): Promise<UnifiedResponse> {
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
    logger.warn('Invalid or expired preorder token for change address', { token: token.substring(0, 8) + '...' });
    return ResponseBuilder.text(
      '⚠️ Esta pre-orden ya no está disponible. Solo puedes cambiar la dirección de la pre-orden más reciente.',
      true
    );
  }
  
  const preOrderId = parseInt(preOrderIdStr, 10);
  
  // Get customer
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
  
  // If no addresses, send link to add one
  if (customer.addresses.length === 0) {
    const otp = OTPService.generateOTP();
    await OTPService.storeOTP(from, otp, true);
    const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${from}?otp=${otp}&preOrderId=${preOrderId}`;
    
    return ResponseBuilder.urlButton(
      "📍 Registrar Dirección",
      "No tienes direcciones guardadas. Por favor, registra una dirección de entrega haciendo clic en el botón de abajo.",
      "Agregar Dirección",
      updateLink
    );
  }
  
  // Always use list for consistency (even with one address)
  const sections = [
    {
      title: "Mis direcciones",
      rows: customer.addresses.map((address) => ({
        id: `select_address_${address.id}:${preOrderId}`,
        title: address.name || `${address.street} ${address.number}`.substring(0, 24),
        description: formatAddressDescription(address).substring(0, 72)
      }))
    }
  ];
  
  // Add option for new address
  sections[0].rows.push({
    id: `add_new_address_preorder:${preOrderId}`,
    title: "➕ Nueva dirección",
    description: "Registrar una nueva dirección de entrega"
  });
  
  // Determine body text based on number of addresses
  const bodyText = customer.addresses.length === 1
    ? "Puedes usar tu dirección actual o agregar una nueva:"
    : "Selecciona la nueva dirección de entrega para tu pedido:";
  
  return ResponseBuilder.interactive({
    type: "list",
    header: {
      type: "text",
      text: "📍 Cambiar Dirección"
    },
    body: {
      text: bodyText
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