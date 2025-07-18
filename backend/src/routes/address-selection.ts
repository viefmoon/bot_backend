import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../common/utils/logger';
import { sendWhatsAppInteractiveMessage, sendWhatsAppMessage } from '../services/whatsapp';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware } from '../common/middlewares/validation.middleware';
import { SendAddressSelectionDto, UpdateAddressSelectionDto } from '../dto/address';

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
      
      const updateLink = `${process.env.FRONTEND_BASE_URL}/address-registration/${customer.whatsappPhoneNumber}?otp=${otp}${preOrderId ? `&preOrderId=${preOrderId}` : ''}`;
      
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
    
    if (customer.addresses.length === 1) {
      // Only one address, use it automatically
      if (preOrderId) {
        await updatePreOrderAddress(parseInt(preOrderId), customer.addresses[0].id);
      }
      
      await sendWhatsAppInteractiveMessage(
        customer.whatsappPhoneNumber,
        {
          type: "button",
          body: {
            text: `📍 *Dirección de entrega:*\n${formatAddress(customer.addresses[0])}\n\n¿Deseas usar esta dirección o cambiarla?`
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: `confirm_address_${customer.addresses[0].id}`,
                  title: "✅ Usar dirección"
                }
              },
              {
                type: "reply", 
                reply: {
                  id: "change_address",
                  title: "🔄 Cambiar dirección"
                }
              }
            ]
          }
        }
      );
      
      res.json({ 
        success: true,
        message: 'Single address confirmation sent',
        hasAddresses: true,
        addressCount: 1
      });
      return;
    }
    
    // Multiple addresses, send selection list
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
    
    await sendWhatsAppInteractiveMessage(
      customer.whatsappPhoneNumber,
      {
        type: "list",
        header: {
          type: "text",
          text: "📍 Seleccionar Dirección"
        },
        body: {
          text: "Por favor selecciona la dirección de entrega para tu pedido:"
        },
        footer: {
          text: "Elige una opción de la lista"
        },
        action: {
          button: "Ver direcciones",
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
    }
  });
  
  if (!address) {
    throw new NotFoundError(
      ErrorCode.ADDRESS_NOT_FOUND,
      'Address not found or does not belong to customer',
      { addressId, customerId }
    );
  }
  
  // Update preorder with selected address
  await updatePreOrderAddress(preOrderId, addressId);
  
  res.json({ 
    success: true,
    message: 'PreOrder address updated successfully'
  });
}));

// Helper functions
function formatAddress(address: any): string {
  const parts = [];
  
  // Add name as the first line if available
  if (address.name) {
    parts.push(`*${address.name}*`);
  }
  
  if (address.street && address.number) {
    let streetLine = `${address.street} ${address.number}`;
    if (address.interiorNumber) {
      streetLine += ` Int. ${address.interiorNumber}`;
    }
    parts.push(streetLine);
  }
  
  if (address.neighborhood) parts.push(address.neighborhood);
  if (address.city && address.state) {
    parts.push(`${address.city}, ${address.state}`);
  }
  
  if (address.deliveryInstructions) {
    parts.push(`Referencias: ${address.deliveryInstructions}`);
  }
  
  return parts.join('\n');
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

async function updatePreOrderAddress(preOrderId: number, addressId: string): Promise<void> {
  // Get the address details
  const address = await prisma.address.findUnique({
    where: { id: addressId }
  });
  
  if (!address) {
    throw new NotFoundError(
      ErrorCode.ADDRESS_NOT_FOUND,
      'Address not found'
    );
  }
  
  // Get existing preorder delivery info
  const preOrder = await prisma.preOrder.findUnique({
    where: { id: preOrderId },
    include: { deliveryInfo: true }
  });
  
  if (!preOrder) {
    throw new NotFoundError(
      ErrorCode.ORDER_NOT_FOUND,
      'PreOrder not found',
      { preOrderId }
    );
  }
  
  const deliveryInfoData = {
    name: address.name,
    street: address.street,
    number: address.number,
    interiorNumber: address.interiorNumber,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
    deliveryInstructions: address.deliveryInstructions,
    latitude: address.latitude?.toNumber(),
    longitude: address.longitude?.toNumber(),
    preOrderId: preOrderId
  };
  
  if (preOrder.deliveryInfo?.id) {
    // Update existing delivery info
    await prisma.deliveryInfo.update({
      where: { id: preOrder.deliveryInfo.id },
      data: deliveryInfoData
    });
  } else {
    // Create new delivery info with preOrderId
    await prisma.deliveryInfo.create({
      data: {
        ...deliveryInfoData,
        preOrderId: preOrderId
      }
    });
  }
  
  logger.info(`Updated preorder ${preOrderId} with address ${addressId}`);
}

/**
 * Regenerate preorder confirmation after address update from frontend
 * POST /backend/address-selection/regenerate-confirmation
 */
router.post('/regenerate-confirmation',
  asyncHandler(async (req: Request, res: Response) => {
    const { preOrderId, customerId } = req.body;
    
    logger.info('Regenerate confirmation request', { preOrderId, customerId });
    
    if (!preOrderId) {
      res.json({ 
        success: true,
        message: 'No preOrderId provided, skipping regeneration'
      });
      return;
    }
    
    // Get the preorder with all details
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: parseInt(preOrderId) },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            productModifiers: true,
            selectedPizzaCustomizations: {
              include: { pizzaCustomization: true }
            }
          }
        },
        deliveryInfo: true
      }
    });
    
    if (!preOrder) {
      throw new NotFoundError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { preOrderId }
      );
    }
    
    // Get customer from preOrder's whatsappPhoneNumber
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: preOrder.whatsappPhoneNumber }
    });
    
    if (!customer) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { whatsappPhoneNumber: preOrder.whatsappPhoneNumber }
      );
    }
    
    // Import required services
    const { ProductCalculationService } = await import('../services/orders/services/ProductCalculationService');
    const { PreOrderWorkflowService } = await import('../services/orders/PreOrderWorkflowService');
    const { redisService } = await import('../services/redis/RedisService');
    
    // Calculate items and totals
    const calculatedItems = await ProductCalculationService.calculateOrderItems(
      preOrder.orderItems.map(item => ({
        productId: item.productId,
        productVariantId: item.productVariantId || undefined,
        quantity: 1,
        comments: undefined,
        selectedModifiers: item.productModifiers.map(m => m.id),
        selectedPizzaCustomizations: item.selectedPizzaCustomizations.map(pc => ({
          pizzaCustomizationId: pc.pizzaCustomizationId,
          half: pc.half,
          action: pc.action
        }))
      }))
    );
    
    const formattedPreOrder = {
      preOrderId: preOrder.id,
      orderType: preOrder.orderType,
      items: calculatedItems.items,
      total: calculatedItems.total,
      deliveryInfo: preOrder.deliveryInfo,
      scheduledAt: preOrder.scheduledAt
    };
    
    // Get the token for this preorder
    const tokenKeys = await redisService.keys('preorder:token:*');
    let token = null;
    for (const key of tokenKeys) {
      const storedPreOrderId = await redisService.get(key);
      if (storedPreOrderId === preOrderId.toString()) {
        token = key.split(':')[2];
        break;
      }
    }
    
    if (token) {
      // Resend the order summary with updated address
      await PreOrderWorkflowService.sendOrderSummaryWithButtons(
        customer.whatsappPhoneNumber,
        formattedPreOrder,
        token
      );
      
    }
    
    res.json({ 
      success: true,
      message: 'PreOrder confirmation regenerated successfully'
    });
}));

export default router;