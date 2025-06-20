import { Router, Request, Response } from 'express';
import { OTPService } from '../services/security/OTPService';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../server';
import logger from '../common/utils/logger';

const router = Router();

/**
 * Verificar OTP para registro de dirección
 * POST /backend/address-registration/verify-otp
 */
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, otp } = req.body;
    
    if (!customerId || !otp) {
      res.status(400).json({ 
        error: 'customerId and otp are required' 
      });
      return;
    }
    
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Obtener información del cliente
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: {
        id: true,
        whatsappPhoneNumber: true,
        firstName: true,
        lastName: true,
        addresses: {
          where: { deletedAt: null },
          orderBy: { isDefault: 'desc' }
        }
      }
    });
    
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    res.json({ 
      valid: true,
      customer: {
        customerId: customer.whatsappPhoneNumber,
        firstName: customer.firstName,
        lastName: customer.lastName,
        hasAddresses: customer.addresses.length > 0,
        addresses: customer.addresses
      }
    });
    
  } catch (error: any) {
    logger.error('Error verifying OTP for address registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Crear nueva dirección para el cliente
 * POST /backend/address-registration/create
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, otp, address } = req.body;
    
    // Validar campos requeridos
    if (!customerId || !otp || !address) {
      res.status(400).json({ 
        error: 'customerId, otp, and address are required' 
      });
      return;
    }
    
    // Verificar OTP primero
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Validar campos de dirección
    const requiredFields = ['street', 'number', 'city', 'state', 'country', 'latitude', 'longitude'];
    const missingFields = requiredFields.filter(field => !address[field]);
    
    if (missingFields.length > 0) {
      res.status(400).json({ 
        error: `Missing required address fields: ${missingFields.join(', ')}` 
      });
      return;
    }
    
    // Obtener primero el UUID real del cliente
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Crear dirección
    const addressData = {
      ...address,
      customer: { connect: { id: customerRecord.id } }
    };
    
    const newAddress = await DeliveryInfoService.createCustomerAddress(addressData);
    
    // Enviar mensaje de confirmación a WhatsApp
    try {
      const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } = await import('../services/whatsapp');
      const { ADDRESS_REGISTRATION_SUCCESS, WELCOME_MESSAGE_INTERACTIVE } = await import('../common/config/predefinedMessages');
      
      // Obtener el número de WhatsApp del cliente
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { whatsappPhoneNumber: true }
      });
      
      // Enviar mensaje de confirmación
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppMessage(
          customer.whatsappPhoneNumber,
          ADDRESS_REGISTRATION_SUCCESS(newAddress)
        );
      }
      
      // Pequeño retraso para asegurar el orden correcto de mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enviar mensaje de bienvenida inmediatamente después
      const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      }
      
      // Marcar que el mensaje de bienvenida fue enviado para evitar duplicados
      // Actualizar lastInteraction a la hora actual para prevenir la detección de isNewConversation
      await prisma.customer.update({
        where: { id: customerRecord.id },
        data: { 
          lastInteraction: new Date()
        }
      });
      
    } catch (msgError) {
      logger.error('Error sending confirmation message:', msgError);
    }
    
    res.json({ 
      success: true,
      address: newAddress
    });
    
  } catch (error: any) {
    logger.error('Error creating address:', error);
    res.status(500).json({ 
      error: 'Failed to create address',
      message: error.message 
    });
  }
});

/**
 * Actualizar dirección existente
 * PUT /backend/address-registration/:addressId
 */
router.put('/:addressId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    const { customerId, otp, address } = req.body;
    
    if (!customerId || !otp || !address) {
      res.status(400).json({ 
        error: 'customerId, otp, and address are required' 
      });
      return;
    }
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Verificar que la dirección pertenece al cliente
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id: addressId,
        customerId: customerRecord.id
      }
    });
    
    if (!existingAddress) {
      res.status(404).json({ 
        error: 'Address not found or does not belong to customer' 
      });
      return;
    }
    
    // Actualizar dirección
    const updatedAddress = await DeliveryInfoService.updateCustomerAddress(
      addressId,
      address
    );
    
    // Enviar notificación de WhatsApp sobre actualización de dirección
    try {
      const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } = await import('../services/whatsapp');
      const { ADDRESS_UPDATE_SUCCESS, WELCOME_MESSAGE_INTERACTIVE } = await import('../common/config/predefinedMessages');
      
      // Obtener el número de WhatsApp del cliente
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { whatsappPhoneNumber: true }
      });
      
      // Enviar confirmación de actualización
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppMessage(
          customer.whatsappPhoneNumber,
          ADDRESS_UPDATE_SUCCESS(updatedAddress)
        );
      }
      
      // Pequeño retraso para asegurar el orden correcto de mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enviar mensaje de bienvenida inmediatamente después
      const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      }
      
      // Marcar que hubo interacción para evitar mensaje de bienvenida duplicado
      await prisma.customer.update({
        where: { id: customerRecord.id },
        data: { 
          lastInteraction: new Date()
        }
      });
      
    } catch (sendError) {
      logger.error('Failed to send WhatsApp notification:', sendError);
      // Continuar aunque WhatsApp falle
    }
    
    res.json({ 
      success: true,
      address: updatedAddress
    });
    
  } catch (error: any) {
    logger.error('Error updating address:', error);
    res.status(500).json({ 
      error: 'Failed to update address',
      message: error.message 
    });
  }
});

/**
 * Obtener direcciones del cliente
 * GET /backend/address-registration/:customerId/addresses
 */
router.get('/:customerId/addresses', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { otp } = req.query;
    
    if (!otp) {
      res.status(400).json({ error: 'OTP is required' });
      return;
    }
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp as string);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid or expired OTP' });
      return;
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    const addresses = await DeliveryInfoService.getCustomerAddresses(customerRecord.id);
    res.json({ addresses });
    
  } catch (error: any) {
    logger.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

/**
 * Eliminar dirección del cliente
 * DELETE /backend/address-registration/:addressId
 */
router.delete('/:addressId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    const { customerId, otp } = req.body;
    
    if (!customerId || !otp) {
      res.status(400).json({ 
        error: 'customerId and otp are required' 
      });
      return;
    }
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Eliminar dirección (eliminación suave)
    await DeliveryInfoService.deleteCustomerAddress(
      addressId,
      customerRecord.id
    );
    
    res.json({ 
      success: true,
      message: 'Address deleted successfully'
    });
    
  } catch (error: any) {
    logger.error('Error deleting address:', error);
    res.status(500).json({ 
      error: 'Failed to delete address',
      message: error.message 
    });
  }
});

/**
 * Establecer dirección como predeterminada
 * PUT /backend/address-registration/:addressId/default
 */
router.put('/:addressId/default', async (req: Request, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    const { customerId, otp } = req.body;
    
    if (!customerId || !otp) {
      res.status(400).json({ 
        error: 'customerId and otp are required' 
      });
      return;
    }
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Establecer como predeterminada
    const updatedAddress = await DeliveryInfoService.setDefaultAddress(
      addressId,
      customerRecord.id
    );
    
    res.json({ 
      success: true,
      address: updatedAddress
    });
    
  } catch (error: any) {
    logger.error('Error setting default address:', error);
    res.status(500).json({ 
      error: 'Failed to set default address',
      message: error.message 
    });
  }
});

/**
 * Obtener polígono del área de entrega
 * GET /backend/address-registration/delivery-area
 */
router.get('/delivery-area', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Obtener configuración del restaurante
    const restaurant = await prisma.restaurantConfig.findFirst({
      select: {
        deliveryCoverageArea: true
      }
    });

    if (!restaurant || !restaurant.deliveryCoverageArea) {
      res.json({ polygonCoords: [] });
      return;
    }

    // Devolver coordenadas del polígono
    res.json({ 
      polygonCoords: restaurant.deliveryCoverageArea
    });

  } catch (error: any) {
    logger.error('Error fetching delivery area:', error);
    res.status(500).json({ error: 'Failed to fetch delivery area' });
  }
});

/**
 * Estado de depuración del OTP (TEMPORAL - ELIMINAR EN PRODUCCIÓN)
 * GET /backend/address-registration/debug/otp-status
 */
router.get('/debug/otp-status', async (req: Request, res: Response): Promise<void> => {
  const stats = OTPService.getStats();
  res.json({ 
    otpStats: stats,
    message: 'Check server logs for detailed OTP information'
  });
});

export default router;