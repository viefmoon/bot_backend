import { handleTextMessage } from "../utils/textMessageHandler";
import { handleInteractiveMessage } from "../utils/interactiveMessageHandler";
import { handleAudioMessage } from "../utils/audioMessageHandler";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import {
  BannedCustomer,
  MessageLog,
  Customer,
  CustomerDeliveryInfo,
  RestaurantConfig,
} from "../models";
import { verificarHorarioAtencion } from "../utils/timeUtils";
import { checkMessageRateLimit } from "../utils/messageRateLimit";
import { Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { BANNED_USER_MESSAGE } from "../config/predefinedMessages";

interface WhatsAppMessage {
  from: string;
  type: string;
  id: string;
  text?: { body: string };
}

interface WebhookEntry {
  changes: Array<{
    value: {
      messages?: WhatsAppMessage[];
    };
  }>;
}

interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

async function checkBannedCustomer(clientId: string): Promise<boolean> {
  return !!(await BannedCustomer.findOne({ where: { clientId } }));
}

async function sendBannedMessage(clientId: string): Promise<void> {
  await sendWhatsAppMessage(clientId, BANNED_USER_MESSAGE);
}

async function handleIncomingWhatsAppMessage(
  message: WhatsAppMessage,
  otpService: OtpService
): Promise<void> {
  const { from, type, id } = message;

  //obtener el config del restaurante
  const config = await RestaurantConfig.findOne();

  //verificar si el mensaje ya ha sido procesado
  if (await MessageLog.findOne({ where: { messageId: id } })) {
    return;
  }
  await MessageLog.create({ messageId: id, processed: true });

  //verificar si el cliente existe, si no existe, crear uno nuevo
  let customer = await Customer.findOne({
    where: { clientId: from },
    include: [{ model: CustomerDeliveryInfo, as: "customerDeliveryInfo" }],
  });
  if (!customer) {
    customer = await Customer.create({ clientId: from });
  }

  // Actualizar la última interacción
  await customer.update({ lastInteraction: new Date() });

  //verificar si está baneado
  if (await checkBannedCustomer(from)) {
    await sendBannedMessage(from);
    return;
  }

  // Verificar el límite de tasa de mensajes
  if (await checkMessageRateLimit(from)) return;

  //verificar horario de atención
  if (!(await verificarHorarioAtencion())) {
    await sendWhatsAppMessage(
      from,
      "Lo sentimos, el restaurante está cerrado en este momento."
    );
    return;
  }

  if (!config || !config.acceptingOrders) {
    await sendWhatsAppMessage(
      from,
      "Lo sentimos, el restaurante no está aceptando pedidos en este momento, puedes intentar más tarde o llamar al restaurante."
    );
    return;
  }

  // Verificar si el cliente tiene información de entrega
  if (!customer.customerDeliveryInfo) {
    const otp = otpService.generateOTP();
    await otpService.storeOTP(from, otp);
    const registrationLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;

    await sendWhatsAppMessage(
      from,
      `Antes de continuar, necesitamos que registres tu información de entrega. Por favor, usa este enlace: ${registrationLink}\n\nEste enlace es válido por un tiempo limitado por razones de seguridad.`
    );
    return;
  }
  //manejar el mensaje dependiendo del tipo
  switch (type) {
    case "text":
      await handleTextMessage(from, message.text.body);
      break;
    case "interactive":
      await handleInteractiveMessage(from, message);
      break;
    case "audio":
      await handleAudioMessage(from, message);
      break;
    default:
      console.log(`Tipo de mensaje no manejado: ${type}`);
      await sendWhatsAppMessage(
        from,
        "Lo siento, no puedo procesar este tipo de mensaje. Por favor, envía un mensaje de texto, interactivo o de audio."
      );
  }
}

// Manejo de mensajes de WhatsApp
export async function handleWhatsAppWebhook(
  req: Request,
  res: Response,
  otpService: OtpService
): Promise<void> {
  res.status(200).send("EVENT_RECEIVED");
  const { object, entry } = req.body as WebhookBody;

  if (object === "whatsapp_business_account") {
    for (const entryItem of entry) {
      for (const change of entryItem.changes) {
        const { value } = change;
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await handleIncomingWhatsAppMessage(message, otpService);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
}
