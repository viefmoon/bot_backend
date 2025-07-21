import { LinkGenerationService } from '../../../services/security/LinkGenerationService';
import { sendMessageWithUrlButton } from '../../../services/whatsapp';
import { wrapWhatsAppHandler } from '../../../common/utils/whatsappErrorHandler';

// Handler para cuando el usuario selecciona "A domicilio"
export const handleRequestDeliveryRegistration = wrapWhatsAppHandler(async (from: string): Promise<void> => {
  const registrationLink = await LinkGenerationService.generateNewAddressLink(from);
  await sendMessageWithUrlButton(
    from,
    "📝 Completa tu Registro",
    "¡Perfecto! Para continuar, por favor completa tu nombre y dirección de entrega.",
    "Registrarme",
    registrationLink
  );
}, 'handleRequestDeliveryRegistration');

// Handler para cuando el usuario selecciona "Recoger en tienda"
export const handleRequestPickupRegistration = wrapWhatsAppHandler(async (from: string): Promise<void> => {
  // Usaremos un nuevo método en LinkGenerationService
  const registrationLink = await LinkGenerationService.generateNameRegistrationLink(from);
  await sendMessageWithUrlButton(
    from,
    "👤 Registro de Nombre",
    "¡Genial! Solo necesitamos que registres tu nombre para identificar tu pedido.",
    "Registrar mi nombre",
    registrationLink
  );
}, 'handleRequestPickupRegistration');