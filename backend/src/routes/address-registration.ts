import { Router, Request, Response } from 'express';
import { OTPService } from '../services/security/OTPService';
import { DeliveryInfoService } from '../services/orders/services/DeliveryInfoService';
import { prisma } from '../server';
import logger from '../common/utils/logger';

const router = Router();

/**
 * Verify OTP for address registration
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
    
    // Get customer info
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
 * Create new address for customer
 * POST /backend/address-registration/create
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, otp, address } = req.body;
    
    // Validate required fields
    if (!customerId || !otp || !address) {
      res.status(400).json({ 
        error: 'customerId, otp, and address are required' 
      });
      return;
    }
    
    // Verify OTP first
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Validate address fields
    const requiredFields = ['street', 'number', 'city', 'state', 'country', 'latitude', 'longitude'];
    const missingFields = requiredFields.filter(field => !address[field]);
    
    if (missingFields.length > 0) {
      res.status(400).json({ 
        error: `Missing required address fields: ${missingFields.join(', ')}` 
      });
      return;
    }
    
    // Get the actual customer UUID first
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Create address
    const addressData = {
      ...address,
      customer: { connect: { id: customerRecord.id } }
    };
    
    const newAddress = await DeliveryInfoService.createCustomerAddress(addressData);
    
    // Send confirmation message to WhatsApp
    try {
      const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } = await import('../services/whatsapp');
      const { ADDRESS_REGISTRATION_SUCCESS, WELCOME_MESSAGE_INTERACTIVE } = await import('../common/config/predefinedMessages');
      
      // Get customer's WhatsApp phone number
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { whatsappPhoneNumber: true }
      });
      
      // Send confirmation message
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppMessage(
          customer.whatsappPhoneNumber,
          ADDRESS_REGISTRATION_SUCCESS(newAddress)
        );
      }
      
      // Small delay to ensure proper message order
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send welcome message immediately after
      const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      }
      
      // Mark that welcome message has been sent to avoid duplicate
      // Update lastInteraction to current time to prevent isNewConversation detection
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
 * Update existing address
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
    
    // Verify OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Get customer by phone number
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Verify address belongs to customer
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
    
    // Update address
    const updatedAddress = await DeliveryInfoService.updateCustomerAddress(
      addressId,
      address
    );
    
    // Send WhatsApp notification about address update
    try {
      const { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } = await import('../services/whatsapp');
      const { ADDRESS_UPDATE_SUCCESS, WELCOME_MESSAGE_INTERACTIVE } = await import('../common/config/predefinedMessages');
      
      // Get customer's WhatsApp phone number
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { whatsappPhoneNumber: true }
      });
      
      // Send update confirmation
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppMessage(
          customer.whatsappPhoneNumber,
          ADDRESS_UPDATE_SUCCESS(updatedAddress)
        );
      }
      
      // Small delay to ensure proper message order
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send welcome message immediately after
      const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
      if (customer?.whatsappPhoneNumber) {
        await sendWhatsAppInteractiveMessage(customer.whatsappPhoneNumber, welcomeMessage);
      }
      
      // Mark that interaction happened to avoid duplicate welcome message
      await prisma.customer.update({
        where: { id: customerRecord.id },
        data: { 
          lastInteraction: new Date()
        }
      });
      
    } catch (sendError) {
      logger.error('Failed to send WhatsApp notification:', sendError);
      // Continue even if WhatsApp fails
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
 * Get customer addresses
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
    
    // Verify OTP
    const isValid = await OTPService.verifyOTP(customerId, otp as string);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid or expired OTP' });
      return;
    }
    
    // Get customer by phone number
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
 * Delete customer address
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
    
    // Verify OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Get customer by phone number
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Delete address (soft delete)
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
 * Set address as default
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
    
    // Verify OTP
    const isValid = await OTPService.verifyOTP(customerId, otp);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Invalid or expired OTP' 
      });
      return;
    }
    
    // Get customer by phone number
    const customerRecord = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: customerId },
      select: { id: true }
    });
    
    if (!customerRecord) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Set as default
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
 * Get delivery area polygon
 * GET /backend/address-registration/delivery-area
 */
router.get('/delivery-area', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get restaurant configuration
    const restaurant = await prisma.restaurantConfig.findFirst({
      select: {
        deliveryCoverageArea: true
      }
    });

    if (!restaurant || !restaurant.deliveryCoverageArea) {
      res.json({ polygonCoords: [] });
      return;
    }

    // Return polygon coordinates
    res.json({ 
      polygonCoords: restaurant.deliveryCoverageArea
    });

  } catch (error: any) {
    logger.error('Error fetching delivery area:', error);
    res.status(500).json({ error: 'Failed to fetch delivery area' });
  }
});

/**
 * Debug OTP status (TEMPORARY - REMOVE IN PRODUCTION)
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