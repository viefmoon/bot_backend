/**
 * Address related interactive message handlers
 */
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage, sendMessageWithUrlButton } from '../../../services/whatsapp';
import { LinkGenerationService } from '../../../services/security/LinkGenerationService';
import { BusinessLogicError, ErrorCode } from '../../../common/services/errors';
import { extractIdFromAction, INTERACTIVE_ACTIONS } from '../../../common/constants/interactiveActions';
import { formatAddressFull } from '../../../common/utils/addressFormatter';
import logger from '../../../common/utils/logger';

/**
 * Handle general change delivery info request
 */
export async function handleChangeDeliveryInfo(from: string): Promise<void> {
  const updateLink = await LinkGenerationService.generateAddressRegistrationLink(from);
  
  // Send message with URL button
  await sendMessageWithUrlButton(
    from,
    "🚚 Actualizar Dirección",
    "Puedes actualizar o agregar una nueva dirección de entrega haciendo clic en el botón de abajo.",
    "Actualizar Dirección",
    updateLink
  );
}


/**
 * Handle address selection
 */
export async function handleAddressSelection(from: string, selectionId: string): Promise<void> {
  // Check if this is from a preorder change address flow
  // Format can be: select_address_[addressId] or select_address_[addressId]:[preOrderId]
  let addressId: string;
  let preOrderId: number | null = null;
  
  if (selectionId.includes(':')) {
    // This is from preorder change address flow
    const baseId = selectionId.split(':')[0];
    addressId = extractIdFromAction(baseId, INTERACTIVE_ACTIONS.SELECT_ADDRESS);
    preOrderId = parseInt(selectionId.split(':')[1], 10);
  } else {
    // Regular address selection
    addressId = extractIdFromAction(selectionId, INTERACTIVE_ACTIONS.SELECT_ADDRESS);
  }
    
    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: from },
      include: {
        addresses: {
          where: { id: addressId }
        }
      }
    });
    
    if (!customer || customer.addresses.length === 0) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer or address not found',
        { userId: from }
      );
    }
    
    const selectedAddress = customer.addresses[0];
    const formattedAddress = formatAddressFull(selectedAddress);
    
    // If we have a specific preOrderId, use it. Otherwise, check for recent preorder
    if (preOrderId) {
      // Recreate preorder with selected address
      const { PreOrderWorkflowService } = await import('../../../services/orders/PreOrderWorkflowService');
      
      try {
        // This will create a new preOrder with the new address and discard the old one
        await PreOrderWorkflowService.recreatePreOrderWithNewAddress({
          oldPreOrderId: preOrderId,
          newAddressId: selectedAddress.id,
          whatsappNumber: from
        });
        
        // The new preOrder summary is automatically sent by recreatePreOrderWithNewAddress
        // No need to send additional messages
      } catch (error) {
        logger.error('Error recreating preOrder with new address:', error);
        await sendWhatsAppMessage(
          from,
          `❌ Hubo un error al actualizar la dirección. Por favor intenta nuevamente.`
        );
      }
    } else {
      // No preOrderId provided, just confirming address selection for future use
      await sendWhatsAppMessage(
        from,
        `✅ *Dirección seleccionada*\n\n📍 *Dirección de entrega:*\n${formattedAddress}\n\nEsta dirección se usará para tu próximo pedido.`
      );
    }
}

/**
 * Handle add new address request
 */
export async function handleAddNewAddress(from: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber: from }
  });
  
  if (!customer) {
    throw new BusinessLogicError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { userId: from }
    );
  }
    
  const preOrder = await prisma.preOrder.findFirst({
    where: { 
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      createdAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  const updateLink = await LinkGenerationService.generateNewAddressLink(
    customer.whatsappPhoneNumber,
    preOrder?.id?.toString()
  );
  
  await sendMessageWithUrlButton(
    from,
    "📍 Agregar Nueva Dirección",
    "Haz clic en el botón de abajo para registrar una nueva dirección de entrega.",
    "Agregar Dirección",
    updateLink
  );
}

/**
 * Handle add new address for a specific preorder
 */
export async function handleAddNewAddressForPreOrder(from: string, preOrderId: number): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber: from }
  });
  
  if (!customer) {
    throw new BusinessLogicError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { userId: from }
    );
  }
  
  const updateLink = await LinkGenerationService.generateNewAddressLink(
    customer.whatsappPhoneNumber,
    preOrderId.toString()
  );
  
  await sendMessageWithUrlButton(
    from,
    "📍 Agregar Nueva Dirección",
    "Haz clic en el botón de abajo para registrar una nueva dirección de entrega para tu pedido actual.",
    "Agregar Dirección",
    updateLink
  );
}

/**
 * Handler for add new address button (from button reply)
 */
export async function handleAddNewAddressFromButton(from: string, buttonId: string): Promise<void> {
  const parts = buttonId.split(':');
  if (parts.length < 2) {
    await sendWhatsAppMessage(from, "❌ Error al procesar la solicitud. Por favor intenta nuevamente.");
    return;
  }
  
  const preOrderId = parseInt(parts[1], 10);
  if (isNaN(preOrderId)) {
    await sendWhatsAppMessage(from, "❌ Error al procesar la solicitud. Por favor intenta nuevamente.");
    return;
  }
  
  await handleAddNewAddressForPreOrder(from, preOrderId);
}

/**
 * Handler for address selection button (from button reply)
 */
export async function handleAddressSelectionButton(from: string, buttonId: string): Promise<void> {
  await handleAddressSelection(from, buttonId);
}