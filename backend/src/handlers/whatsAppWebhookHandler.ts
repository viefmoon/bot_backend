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
  await sendWhatsAppMessage(
    clientId,
    "Lo sentimos, tu número ha sido baneado debido a la detección de un uso inadecuado de nuestro servicio. " +
      "Si crees que es un error, por favor contacta directamente con el restaurante:\n\n" +
      "📞 Teléfono fijo: 3919160126\n" +
      "📱 Celular: 3338423316\n\n" +
      "Agradecemos tu comprensión y esperamos resolver cualquier malentendido."
  );
}

async function handleIncomingWhatsAppMessage(
  message: WhatsAppMessage,
  otpService: OtpService
): Promise<void> {
  const { from, type, id } = message;

  if (await MessageLog.findOne({ where: { messageId: id } })) {
    return;
  }
  await MessageLog.create({ messageId: id, processed: true });

  console.log("Mensaje recibido de:", from);

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

  const config = await RestaurantConfig.findOne();
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
