import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../common/utils/logger';
import { sendWhatsAppInteractiveMessage, sendWhatsAppMessage } from '../services/whatsapp';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware } from '../common/middlewares/validation.middleware';
import { SendAddressSelectionDto, UpdateAddressSelectionDto } from '../dto/address';
import { formatAddressFull } from '../common/utils/addressFormatter';

const router = Router();

/**
 * Send address selection message to customer
 * POST /backend/address-selection/send
 */
router.post('/send',
  validationMiddleware(SendAddressSelectionDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId, preOrderId } = req.body as SendAddressSelectionDto;
  
  // Get customer with addresses
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: {
        where: { deletedAt: null },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5 // Limit to 5 addresses for WhatsApp list
      }
    }
  });
  
  if (!customer) {
    throw new NotFoundError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { customerId }
    );
  }
    
    if (customer.addresses.length === 0) {
      // No addresses, send link to add one
      const { OTPService } = await import('../services/security/OTPService');
      const otp = OTPService.generateOTP();
      await OTPService.storeOTP(customer.whatsappPhoneNumber, otp, true);
      
      const updateLink = `${process.env.FRONTEND_BASE_URL}/address-registration/${customer.whatsappPhoneNumber}?otp=${otp}${preOrderId ? `&preOrderId=${preOrderId}` : ''}&viewMode=form`;
      
      const { sendMessageWithUrlButton } = await import('../services/whatsapp');
      await sendMessageWithUrlButton(
        customer.whatsappPhoneNumber,
        "📍 Registrar Dirección",
        "No tienes direcciones guardadas. Por favor, registra una dirección de entrega haciendo clic en el botón de abajo.",
        "Agregar Dirección",
        updateLink
      );
      
      res.json({ 
        success: true,
        message: 'Address registration link sent',
        hasAddresses: false
      });
      return;
    }
    
    // Always use list for consistency
    const sections = [
      {
        title: "Mis direcciones",
        rows: customer.addresses.map((address) => ({
          id: `select_address_${address.id}`,
          title: truncateText(address.name || `${address.street} ${address.number}`, 24),
          description: truncateText(
            address.name 
              ? `${address.street} ${address.number}, ${address.neighborhood || address.city}${address.isDefault ? ' (Principal)' : ''}`
              : `${address.neighborhood ? address.neighborhood + ', ' : ''}${address.city}${address.isDefault ? ' (Principal)' : ''}`,
            72
          )
        }))
      }
    ];
    
    // Add option to add new address
    sections[0].rows.push({
      id: "add_new_address",
      title: "➕ Nueva dirección",
      description: "Registrar una nueva dirección de entrega"
    });
    
    // Determine body text based on number of addresses
    const bodyText = customer.addresses.length === 1
      ? "Puedes usar tu dirección actual o agregar una nueva:"
      : "Por favor selecciona la dirección de entrega para tu pedido:";
    
    await sendWhatsAppInteractiveMessage(
      customer.whatsappPhoneNumber,
      {
        type: "list",
        header: {
          type: "text",
          text: "📍 Seleccionar Dirección"
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
      }
    );
    
    res.json({ 
      success: true,
      message: 'Address selection list sent',
      hasAddresses: true,
      addressCount: customer.addresses.length
    });
}));

/**
 * Update selected address for preorder
 * POST /backend/address-selection/update
 */
router.post('/update',
  validationMiddleware(UpdateAddressSelectionDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { preOrderId, addressId, customerId } = req.body as UpdateAddressSelectionDto;
  
  // Verify address belongs to customer
  const address = await prisma.address.findFirst({
    where: { 
      id: addressId,
      customerId,
      deletedAt: null
    },
    include: { customer: true }
  });
  
  if (!address) {
    throw new NotFoundError(
      ErrorCode.ADDRESS_NOT_FOUND,
      'Address not found or does not belong to customer',
      { addressId, customerId }
    );
  }
  
  // Get the preOrder to get whatsappPhoneNumber
  const preOrder = await prisma.preOrder.findUnique({
    where: { id: preOrderId }
  });
  
  if (!preOrder) {
    throw new NotFoundError(
      ErrorCode.ORDER_NOT_FOUND,
      'PreOrder not found',
      { preOrderId }
    );
  }
  
  // Recreate preOrder with new address
  const { PreOrderWorkflowService } = await import('../services/orders/PreOrderWorkflowService');
  const result = await PreOrderWorkflowService.recreatePreOrderWithNewAddress({
    oldPreOrderId: preOrderId,
    newAddressId: addressId,
    whatsappNumber: preOrder.whatsappPhoneNumber
  });
  
  res.json({ 
    success: true,
    message: 'New PreOrder created with updated address',
    preOrderId: result.preOrderId
  });
}));

// Helper functions
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}



export default router;