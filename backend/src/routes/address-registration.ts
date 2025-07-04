import { Router, Request, Response } from 'express';
import { OTPService } from '../services/security/OTPService';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../server';
import logger from '../common/utils/logger';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { ValidationError, NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware, queryValidationMiddleware } from '../common/middlewares/validation.middleware';
import { otpAuthMiddleware, AuthenticatedRequest } from '../common/middlewares/otp.middleware';
import { SyncMetadataService } from '../services/sync/SyncMetadataService';
import {
  VerifyOtpDto,
  CreateAddressDto,
  UpdateAddressDto,
  GetAddressesQueryDto,
  DeleteAddressDto,
  SetDefaultAddressDto,
  UpdateCustomerNameDto
} from './dto/address-registration';

const router = Router();

/**
 * Verificar OTP para registro de dirección
 * POST /backend/address-registration/verify-otp
 */
router.post('/verify-otp', 
  validationMiddleware(VerifyOtpDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { whatsappPhoneNumber, otp } = req.body as VerifyOtpDto;
  
  const isValid = await OTPService.verifyOTP(whatsappPhoneNumber, otp);
  
  if (!isValid) {
    throw new ValidationError(
      ErrorCode.INVALID_OTP,
      'Invalid or expired OTP'
    );
  }
  
  // Obtener información del cliente
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber },
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
    throw new NotFoundError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { whatsappPhoneNumber }
    );
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
}));


/**
 * Crear nueva dirección para el cliente
 * POST /backend/address-registration/create
 */
router.post('/create',
  validationMiddleware(CreateAddressDto),
  otpAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { address } = req.body as CreateAddressDto;
    const customer = req.customer; // Customer already validated by middleware
    
    // Crear dirección
    const addressData = {
      ...address,
      customer: { connect: { id: customer.id } }
    };
    
    const newAddress = await DeliveryInfoService.createCustomerAddress(addressData);
    
    // Mark customer for sync since addresses are part of customer data
    await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    
    // Enviar mensaje de confirmación a WhatsApp
    try {
      const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } = await import('../services/whatsapp');
      const { ADDRESS_REGISTRATION_SUCCESS, WELCOME_MESSAGE_INTERACTIVE } = await import('../common/config/predefinedMessages');
      const { ConfigService } = await import('../services/config/ConfigService');
      
      // Usar whatsappPhoneNumber del customer autenticado
      await sendWhatsAppMessage(
        customer.whatsappPhoneNumber,
        ADDRESS_REGISTRATION_SUCCESS(newAddress)
      );
      
      // Pequeño retraso para asegurar el orden correcto de mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enviar mensaje de bienvenida inmediatamente después
      const config = ConfigService.getConfig();
      const welcomeMessage = WELCOME_MESSAGE_INTERACTIVE(config);
      await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      
      // Marcar que el mensaje de bienvenida fue enviado para evitar duplicados
      // Actualizar lastInteraction a la hora actual para prevenir la detección de isNewConversation
      await prisma.customer.update({
        where: { id: customer.id },
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
  })
);

/**
 * Actualizar nombre del cliente
 * PUT /backend/address-registration/update-customer-name
 */
router.put('/update-customer-name',
  validationMiddleware(UpdateCustomerNameDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { whatsappPhoneNumber, otp, firstName, lastName } = req.body as UpdateCustomerNameDto;
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(whatsappPhoneNumber, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Actualizar nombre del cliente
    const updatedCustomer = await prisma.customer.update({
      where: { whatsappPhoneNumber },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      },
      select: {
        id: true,
        whatsappPhoneNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        addresses: {
          where: { deletedAt: null },
          orderBy: { isDefault: 'desc' }
        }
      }
    });
    
    // Mark for sync
    await SyncMetadataService.markForSync('Customer', updatedCustomer.id, 'REMOTE');
    
    res.json({
      success: true,
      customer: updatedCustomer
    });
  })
);

/**
 * Actualizar dirección existente
 * PUT /backend/address-registration/:addressId
 */
router.put('/:addressId',
  validationMiddleware(UpdateAddressDto),
  otpAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { addressId } = req.params;
    const { address } = req.body as UpdateAddressDto;
    const customer = req.customer; // Customer already validated by middleware
    
    // Verificar que la dirección pertenece al cliente
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id: addressId,
        customerId: customer.id
      }
    });
    
    if (!existingAddress) {
      throw new NotFoundError(
        ErrorCode.ADDRESS_NOT_FOUND,
        'Address not found or does not belong to customer',
        { addressId, customerId: customer.id }
      );
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
      const { ConfigService } = await import('../services/config/ConfigService');
      
      // Usar whatsappPhoneNumber del customer autenticado
      await sendWhatsAppMessage(
        customer.whatsappPhoneNumber,
        ADDRESS_UPDATE_SUCCESS(updatedAddress)
      );
      
      // Pequeño retraso para asegurar el orden correcto de mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enviar mensaje de bienvenida inmediatamente después
      const config = ConfigService.getConfig();
      const welcomeMessage = WELCOME_MESSAGE_INTERACTIVE(config);
      await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      
      // Marcar que hubo interacción para evitar mensaje de bienvenida duplicado
      await prisma.customer.update({
        where: { id: customer.id },
        data: { 
          lastInteraction: new Date()
        }
      });
      
      // Mark for sync
      await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
      
    } catch (sendError) {
      logger.error('Failed to send WhatsApp notification:', sendError);
      // Continuar aunque WhatsApp falle
    }
    
    res.json({ 
      success: true,
      address: updatedAddress
    });
  })
);

/**
 * Obtener direcciones del cliente
 * GET /backend/address-registration/:customerId/addresses
 */
router.get('/:customerId/addresses',
  queryValidationMiddleware(GetAddressesQueryDto),
  otpAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const customer = req.customer; // Customer already validated by middleware
    
    const addresses = await DeliveryInfoService.getCustomerAddresses(customer.id);
    res.json({ addresses });
  })
);

/**
 * Eliminar dirección del cliente
 * DELETE /backend/address-registration/:addressId
 */
router.delete('/:addressId',
  validationMiddleware(DeleteAddressDto),
  otpAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { addressId } = req.params;
    const customer = req.customer; // Customer already validated by middleware
    
    // Eliminar dirección (eliminación suave)
    await DeliveryInfoService.deleteCustomerAddress(
      addressId,
      customer.id
    );
    
    // Mark customer for sync since addresses are part of customer data
    await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    
    res.json({ 
      success: true,
      message: 'Address deleted successfully'
    });
  })
);

/**
 * Establecer dirección como predeterminada
 * PUT /backend/address-registration/:addressId/default
 */
router.put('/:addressId/default',
  validationMiddleware(SetDefaultAddressDto),
  otpAuthMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { addressId } = req.params;
    const customer = req.customer; // Customer already validated by middleware
    
    // Establecer como predeterminada
    const updatedAddress = await DeliveryInfoService.setDefaultAddress(
      addressId,
      customer.id
    );
    
    // Mark customer for sync since addresses are part of customer data
    await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
    
    // Enviar notificación de WhatsApp sobre cambio de dirección principal
    try {
      const { sendWhatsAppMessage } = await import('../services/whatsapp');
      const { DEFAULT_ADDRESS_CHANGED } = await import('../common/config/predefinedMessages');
      
      await sendWhatsAppMessage(
        customer.whatsappPhoneNumber, 
        DEFAULT_ADDRESS_CHANGED(updatedAddress)
      );
    } catch (msgError) {
      logger.error('Error sending default address notification:', msgError);
    }
    
    res.json({ 
      success: true,
      address: updatedAddress
    });
  })
);

/**
 * Obtener polígono del área de entrega
 * GET /backend/address-registration/delivery-area
 */
router.get('/delivery-area', asyncHandler(async (_req: Request, res: Response) => {
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
  })
);

/**
 * Estado de depuración del OTP (TEMPORAL - ELIMINAR EN PRODUCCIÓN)
 * GET /backend/address-registration/debug/otp-status
 */
router.get('/debug/otp-status', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await OTPService.getStats();
  res.json({ 
    otpStats: stats,
    message: 'Check server logs for detailed OTP information'
  });
}));

export default router;