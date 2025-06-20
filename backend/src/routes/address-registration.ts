import { Router, Request, Response } from 'express';
import { OTPService } from '../services/security/OTPService';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../server';
import logger from '../common/utils/logger';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { ValidationError, NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware, queryValidationMiddleware } from '../common/middlewares/validation.middleware';
import {
  VerifyOtpDto,
  CreateAddressDto,
  UpdateAddressDto,
  GetAddressesQueryDto,
  DeleteAddressDto,
  SetDefaultAddressDto
} from './dto/address-registration';

const router = Router();

/**
 * Verificar OTP para registro de dirección
 * POST /backend/address-registration/verify-otp
 */
router.post('/verify-otp', 
  validationMiddleware(VerifyOtpDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId, otp } = req.body as VerifyOtpDto;
  
  const isValid = await OTPService.verifyOTP(customerId, otp);
  
  if (!isValid) {
    throw new ValidationError(
      ErrorCode.INVALID_OTP,
      'Invalid or expired OTP'
    );
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
    throw new NotFoundError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found',
      { customerId }
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
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId, otp, address } = req.body as CreateAddressDto;
    
    // Verificar OTP primero
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Obtener primero el UUID real del cliente
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId }
      );
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
  })
);

/**
 * Actualizar dirección existente
 * PUT /backend/address-registration/:addressId
 */
router.put('/:addressId',
  validationMiddleware(UpdateAddressDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const { customerId, otp, address } = req.body as UpdateAddressDto;
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId }
      );
    }
    
    // Verificar que la dirección pertenece al cliente
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id: addressId,
        customerId: customerRecord.id
      }
    });
    
    if (!existingAddress) {
      throw new NotFoundError(
        ErrorCode.ADDRESS_NOT_FOUND,
        'Address not found or does not belong to customer',
        { addressId, customerId: customerRecord.id }
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
  })
);

/**
 * Obtener direcciones del cliente
 * GET /backend/address-registration/:customerId/addresses
 */
router.get('/:customerId/addresses',
  queryValidationMiddleware(GetAddressesQueryDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const { otp } = req.query as unknown as GetAddressesQueryDto;
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId }
      );
    }
    
    const addresses = await DeliveryInfoService.getCustomerAddresses(customerRecord.id);
    res.json({ addresses });
  })
);

/**
 * Eliminar dirección del cliente
 * DELETE /backend/address-registration/:addressId
 */
router.delete('/:addressId',
  validationMiddleware(DeleteAddressDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const { customerId, otp } = req.body as DeleteAddressDto;
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId }
      );
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
  })
);

/**
 * Establecer dirección como predeterminada
 * PUT /backend/address-registration/:addressId/default
 */
router.put('/:addressId/default',
  validationMiddleware(SetDefaultAddressDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { addressId } = req.params;
    const { customerId, otp } = req.body as SetDefaultAddressDto;
    
    // Verificar OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      throw new ValidationError(
        ErrorCode.INVALID_OTP,
        'Invalid or expired OTP'
      );
    }
    
    // Obtener cliente por número de teléfono
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      throw new NotFoundError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { customerId }
      );
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
  const stats = OTPService.getStats();
  res.json({ 
    otpStats: stats,
    message: 'Check server logs for detailed OTP information'
  });
}));

export default router;