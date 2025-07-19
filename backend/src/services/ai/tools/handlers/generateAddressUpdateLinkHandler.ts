import { ToolHandler } from '../types';
import { MessageContext } from '../../../messaging/MessageContext';
import { LinkGenerationService } from '../../../security/LinkGenerationService';
import { TechnicalError, ErrorCode } from '../../../../common/services/errors';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the generate_address_update_link function call
 * Generates a secure OTP link for address updates
 */
export const handleGenerateAddressUpdateLink: ToolHandler = async (args, context?: MessageContext): Promise<UnifiedResponse> => {
  logger.debug('Generating address update link:', args);
  
  // Get customerId from context
  const customerId = context?.message?.from;
  if (!customerId) {
    throw new TechnicalError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Could not get customer ID from message context'
    );
  }
  
  // Generate secure registration link
  const registrationLink = await LinkGenerationService.generateAddressRegistrationLink(customerId);
  
  // Create response with URL button using the new dedicated method
  return ResponseBuilder.urlButton(
    "📍 Actualizar Dirección",
    "Te he generado un enlace seguro para que puedas actualizar o agregar una nueva dirección de entrega.\n\n" +
    "Este enlace es temporal y expirará en 10 minutos por seguridad.",
    "Actualizar Dirección",
    registrationLink
  );
};