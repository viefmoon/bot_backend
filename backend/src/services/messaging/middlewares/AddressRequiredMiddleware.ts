import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendMessageWithUrlButton } from '../../whatsapp';
import { OTPService } from '../../security/OTPService';
import { env } from '../../../common/config/envValidator';
import logger from '../../../common/utils/logger';

export class AddressRequiredMiddleware implements MessageMiddleware {
  name = 'AddressRequiredMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      const hasNoAddress = context.get('hasNoAddress');
      const customerId = context.message.from;
      
      // Si el cliente no tiene dirección, bloquear la conversación
      if (hasNoAddress) {
        logger.info(`Blocking conversation for customer ${customerId} - no address on file`);
        
        // Generar OTP con expiración extendida para registro de dirección
        const otp = OTPService.generateOTP();
        await OTPService.storeOTP(customerId, otp, true); // true = address registration
        
        // Crear enlace de registro - directo al formulario para primera vez
        const registrationLink = `${env.FRONTEND_BASE_URL}/address-registration/${customerId}?otp=${otp}&viewMode=form`;
        
        // Enviar mensaje con botón URL
        await sendMessageWithUrlButton(
          customerId,
          "🏠 ¡Bienvenido!",
          "Para poder tomar tu pedido, necesitamos que registres tu dirección de entrega.\n\nEs muy fácil y rápido:\n• Haz clic en el botón de abajo\n• Completa tu información\n• ¡Listo para ordenar!",
          "Registrar Dirección",
          registrationLink
        );
        
        // Detener el procesamiento - no procesar ningún mensaje hasta que tenga dirección
        context.stop();
        return context;
      }
      
      return context;
    } catch (error) {
      logger.error('Error in AddressRequiredMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}