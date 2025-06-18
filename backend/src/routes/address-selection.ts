import { Router, Request, Response } from 'express';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../server';
import logger from '../common/utils/logger';
import { sendWhatsAppInteractiveMessage } from '../services/whatsapp';

const router = Router();

/**
 * Send address selection message to customer
 * POST /backend/address-selection/send
 */
router.post('/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, preOrderId } = req.body;
    
    if (!customerId) {
      res.status(400).json({ 
        error: 'customerId is required' 
      });
      return;
    }
    
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
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    if (customer.addresses.length === 0) {
      // No addresses, send link to add one
      const { OTPService } = await import('../services/security/OTPService');
      const otp = OTPService.generateOTP();
      OTPService.storeOTP(customer.whatsappPhoneNumber, otp, true);
      
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
                  title: "✅ Usar esta dirección"
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
        rows: customer.addresses.map((address, index) => ({
          id: `select_address_${address.id}`,
          title: truncateText(`${address.street} ${address.number}`, 24),
          description: truncateText(
            `${address.neighborhood ? address.neighborhood + ', ' : ''}${address.city}${address.isDefault ? ' (Principal)' : ''}`,
            72
          )
        }))
      }
    ];
    
    // Add option to add new address
    sections[0].rows.push({
      id: "add_new_address",
      title: "➕ Agregar nueva dirección",
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
    
  } catch (error: any) {
    logger.error('Error sending address selection:', error);
    res.status(500).json({ 
      error: 'Failed to send address selection',
      message: error.message 
    });
  }
});

/**
 * Update selected address for preorder
 * POST /backend/address-selection/update
 */
router.post('/update', async (req: Request, res: Response): Promise<void> => {
  try {
    const { preOrderId, addressId, customerId } = req.body;
    
    if (!preOrderId || !addressId || !customerId) {
      res.status(400).json({ 
        error: 'preOrderId, addressId, and customerId are required' 
      });
      return;
    }
    
    // Verify address belongs to customer
    const address = await prisma.address.findFirst({
      where: { 
        id: addressId,
        customerId,
        deletedAt: null
      }
    });
    
    if (!address) {
      res.status(404).json({ 
        error: 'Address not found or does not belong to customer' 
      });
      return;
    }
    
    // Update preorder with selected address
    await updatePreOrderAddress(preOrderId, addressId);
    
    res.json({ 
      success: true,
      message: 'PreOrder address updated successfully'
    });
    
  } catch (error: any) {
    logger.error('Error updating preorder address:', error);
    res.status(500).json({ 
      error: 'Failed to update address',
      message: error.message 
    });
  }
});

// Helper functions
function formatAddress(address: any): string {
  const parts = [];
  
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
  
  if (address.references) {
    parts.push(`Referencias: ${address.references}`);
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
    throw new Error('Address not found');
  }
  
  // Get existing preorder delivery info
  const preOrder = await prisma.preOrder.findUnique({
    where: { id: preOrderId },
    include: { deliveryInfo: true }
  });
  
  if (!preOrder) {
    throw new Error('PreOrder not found');
  }
  
  const deliveryInfoData = {
    street: address.street,
    number: address.number,
    interiorNumber: address.interiorNumber,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
    references: address.references,
    latitude: address.latitude?.toNumber(),
    longitude: address.longitude?.toNumber(),
    preOrderId: preOrderId
  };
  
  if (preOrder.deliveryInfo && preOrder.deliveryInfo.length > 0) {
    // Update existing delivery info
    await prisma.orderDeliveryInfo.update({
      where: { id: preOrder.deliveryInfo[0].id },
      data: deliveryInfoData
    });
  } else {
    // Create new delivery info
    await prisma.orderDeliveryInfo.create({
      data: deliveryInfoData
    });
  }
  
  logger.info(`Updated preorder ${preOrderId} with address ${addressId}`);
}

export default router;