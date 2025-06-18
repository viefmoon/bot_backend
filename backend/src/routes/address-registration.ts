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
      where: { customerId },
      select: {
        customerId: true,
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
        customerId: customer.customerId,
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
    
    // Create address
    const addressData = {
      ...address,
      customer: { connect: { customerId } }
    };
    
    const newAddress = await DeliveryInfoService.createCustomerAddress(addressData);
    
    // Send confirmation message to WhatsApp
    try {
      const { sendWhatsAppMessage } = await import('../services/whatsapp');
      const { ADDRESS_REGISTRATION_SUCCESS } = await import('../common/config/predefinedMessages');
      await sendWhatsAppMessage(
        customerId,
        ADDRESS_REGISTRATION_SUCCESS(newAddress)
      );
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
    
    // Verify address belongs to customer
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id: parseInt(addressId),
        customerId
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
      parseInt(addressId),
      address
    );
    
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
    
    const addresses = await DeliveryInfoService.getCustomerAddresses(customerId);
    res.json({ addresses });
    
  } catch (error: any) {
    logger.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
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