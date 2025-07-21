import { OTPService } from './OTPService';
import { env } from '../../common/config/envValidator';
import logger from '../../common/utils/logger';

export interface AddressLinkOptions {
  viewMode?: 'form' | 'list';
  preOrderId?: string;
}

/**
 * Service for generating secure links with OTP authentication
 */
export class LinkGenerationService {
  /**
   * Generates an address registration link with OTP
   * @param whatsappPhoneNumber - The customer's WhatsApp phone number
   * @param options - Optional parameters for the link
   * @returns The complete registration URL
   */
  static async generateAddressRegistrationLink(
    whatsappPhoneNumber: string,
    options: AddressLinkOptions = {}
  ): Promise<string> {
    // Generate OTP
    const otp = OTPService.generateOTP();
    
    // Store OTP with address registration flag
    await OTPService.storeOTP(whatsappPhoneNumber, otp, true);
    
    // Build base URL
    let url = `${env.FRONTEND_BASE_URL}/address-registration/${whatsappPhoneNumber}?otp=${otp}`;
    
    // Add optional parameters
    if (options.viewMode) {
      url += `&viewMode=${options.viewMode}`;
    }
    
    if (options.preOrderId) {
      url += `&preOrderId=${options.preOrderId}`;
    }
    
    logger.info('Generated address registration link', {
      whatsappPhoneNumber,
      hasPreOrderId: !!options.preOrderId,
      viewMode: options.viewMode || 'default'
    });
    
    return url;
  }
  
  /**
   * Generates a link for new address registration (always goes to form view)
   * @param whatsappPhoneNumber - The customer's WhatsApp phone number
   * @param preOrderId - Optional pre-order ID to link the address to
   * @returns The registration URL directed to form view
   */
  static async generateNewAddressLink(
    whatsappPhoneNumber: string,
    preOrderId?: string
  ): Promise<string> {
    return this.generateAddressRegistrationLink(whatsappPhoneNumber, {
      viewMode: 'form',
      preOrderId
    });
  }
  
  /**
   * Generates a link for name-only registration (for pickup orders)
   * @param whatsappPhoneNumber - The customer's WhatsApp phone number
   * @returns The registration URL directed to name-only form view
   */
  static async generateNameRegistrationLink(
    whatsappPhoneNumber: string
  ): Promise<string> {
    const otp = OTPService.generateOTP();
    await OTPService.storeOTP(whatsappPhoneNumber, otp, true);
    
    // La clave es el query param `mode=nameOnly`
    const url = `${env.FRONTEND_BASE_URL}/address-registration/${whatsappPhoneNumber}?otp=${otp}&mode=nameOnly`;
    
    logger.info('Generated name-only registration link', { whatsappPhoneNumber });
    
    return url;
  }
}