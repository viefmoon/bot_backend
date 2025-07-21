import { Router, Request, Response } from 'express';
import { OTPService } from '../services/security/OTPService';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../lib/prisma';
import logger from '../common/utils/logger';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { ValidationError, NotFoundError, ErrorCode } from '../common/services/errors';
import { validationMiddleware, queryValidationMiddleware } from '../common/middlewares/validation.middleware';
import { otpAuthMiddleware, AuthenticatedRequest } from '../common/middlewares/otp.middleware';
import { SyncMetadataService } from '../services/sync/SyncMetadataService';
import {
  VerifyOtpDto
} from '../dto/auth';
import {
  CreateAddressDto,
  UpdateAddressDto,
  GetAddressesQueryDto
} from '../dto/address';
import {
  UpdateCustomerNameDto
} from '../dto/customer';
import { Address } from '@prisma/client';

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
    
    // Si viene de un preOrder, actualizar la dirección del preOrder
    const preOrderId = req.query.preOrderId || req.body.preOrderId;
    if (preOrderId) {
      await updatePreOrderWithAddress(parseInt(preOrderId as string), newAddress);
    }
    
    // Enviar mensaje de confirmación a WhatsApp
    try {
      const { sendWhatsAppMessage } = await import('../services/whatsapp');
      const { ADDRESS_REGISTRATION_SUCCESS } = await import('../common/config/predefinedMessages');
      
      // Verificar si viene de un preOrder (el frontend lo pasa como query param)
      const isFromPreOrder = preOrderId;
      
      if (!isFromPreOrder) {
        // Enviar ÚNICAMENTE el mensaje de éxito del registro
        // Este mensaje ya guía al usuario sobre el siguiente paso
        await sendWhatsAppMessage(
          customer.whatsappPhoneNumber,
          ADDRESS_REGISTRATION_SUCCESS(newAddress)
        );
      }
      
      // Siempre actualizar lastInteraction
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
    
    // Verificar si el cliente tiene direcciones
    const addressCount = await prisma.address.count({
      where: { customerId: updatedCustomer.id, deletedAt: null }
    });

    // Si no tiene direcciones, es el flujo de "Recolección", enviar mensaje de éxito
    if (addressCount === 0) {
      try {
        const { sendWhatsAppMessage } = await import('../services/whatsapp');

        // Solo enviar mensaje de confirmación, sin mensaje de bienvenida
        await sendWhatsAppMessage(
          whatsappPhoneNumber,
          `✅ ¡Gracias ${firstName}! Tu nombre ha sido registrado exitosamente. Ahora puedes realizar tu pedido.`
        );
      } catch (msgError) {
        logger.error('Error sending confirmation message for name registration:', msgError);
      }
    }
    
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
    const addressData = req.body as UpdateAddressDto;
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
      addressData
    );
    
    // Enviar notificación de WhatsApp sobre actualización de dirección
    try {
      const { sendWhatsAppMessage } = await import('../services/whatsapp');
      const { ADDRESS_UPDATE_SUCCESS } = await import('../common/config/predefinedMessages');
      
      // Solo enviar el mensaje de confirmación de actualización
      await sendWhatsAppMessage(
        customer.whatsappPhoneNumber,
        ADDRESS_UPDATE_SUCCESS(updatedAddress)
      );
      
      // Actualizar lastInteraction
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
 * Establecer dirección como predeterminada
 * PUT /backend/address-registration/:addressId/default
 */
router.put('/:addressId/default',
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
 * Helper function to recreate preOrder with new address
 */
async function updatePreOrderWithAddress(preOrderId: number, address: Address): Promise<void> {
  const preOrder = await prisma.preOrder.findUnique({
    where: { id: preOrderId }
  });
  
  if (!preOrder) {
    return;
  }
  
  const { PreOrderWorkflowService } = await import('../services/orders/PreOrderWorkflowService');
  await PreOrderWorkflowService.recreatePreOrderWithNewAddress({
    oldPreOrderId: preOrderId,
    newAddressId: address.id,
    whatsappNumber: preOrder.whatsappPhoneNumber
  });
}

export default router;