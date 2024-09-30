import { handleTextMessage } from "../utils/textMessageHandler";
import { handleInteractiveMessage } from "../utils/interactiveMessageHandler";
import { handleAudioMessage } from "../utils/audioMessageHandler";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import { BannedCustomer, MessageLog } from "../models";
import { verificarHorarioAtencion } from "../utils/timeUtils";
import { checkMessageRateLimit } from "../utils/messageRateLimit";
import { Customer, CustomerDeliveryInfo } from "../models";

async function checkBannedCustomer(clientId) {
  return !!(await BannedCustomer.findOne({ where: { clientId } }));
}

async function sendBannedMessage(clientId) {
  await sendWhatsAppMessage(
    clientId,
    "Lo sentimos, tu número ha sido baneado debido a la detección de un uso inadecuado de nuestro servicio. " +
      "Si crees que es un error, por favor contacta directamente con el restaurante:\n\n" +
      "📞 Teléfono fijo: 3919160126\n" +
      "📱 Celular: 3338423316\n\n" +
      "Agradecemos tu comprensión y esperamos resolver cualquier malentendido.",
  );
}

async function handleIncomingWhatsAppMessage(message) {
  const { from, type, id } = message;

  console.log("Mensaje recibido de:", from);
  //ver si ya se procesó
  if (await MessageLog.findOne({ where: { messageId: id } })) {
    return;
  }
  await MessageLog.create({ messageId: id, processed: true });

  let customer = await Customer.findOne({
    where: { clientId: from },
    include: [{ model: CustomerDeliveryInfo, as: "customerDeliveryInfo" }],
  });
  if (!customer) {
    customer = await Customer.create({ clientId: from });
  }

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
      "Lo sentimos, el restaurante está cerrado en este momento.",
    );
    return;
  }
  // Verificar si el cliente tiene información de entrega
  // if (!customer.CustomerDeliveryInfo) {
  //   await sendWhatsAppMessage(
  //     from,
  //     "Antes de continuar, necesitamos que registres tu información de entrega. Por favor, proporciona tu dirección completa, podras cambiarla en cualquier momento.",
  //   );
  //   return;
  // }

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
export async function handleWhatsAppWebhook(req, res) {
  res.status(200).send("EVENT_RECEIVED");
  const { object, entry } = req.body;

  if (object === "whatsapp_business_account") {
    for (const entryItem of entry) {
      for (const change of entryItem.changes) {
        const { value } = change;
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await handleIncomingWhatsAppMessage(message);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
}
