import { handleTextMessage } from "./textMessageHandler";
import { handleInteractiveMessage } from "./interactiveMessageHandler";
import { handleAudioMessage } from "./audioMessageHandler";
import { sendWhatsAppMessage } from "./whatsAppUtils";
import { BannedCustomer, MessageLog } from "../models";
import { verificarHorarioAtencion } from "./timeUtils";

async function checkBannedCustomer(clientId) {
  return !!(await BannedCustomer.findOne({ where: { clientId } }));
}

async function sendBannedMessage(clientId) {
  await sendWhatsAppMessage(
    clientId,
    "Lo sentimos, tu número ha sido baneado. Contacta con el restaurante si crees que es un error."
  );
}

export async function processMessage(message) {
  const { from, type, id } = message;

  if (await checkBannedCustomer(from)) {
    await sendBannedMessage(from);
    return;
  }

  if (await MessageLog.findOne({ where: { messageId: id } })) {
    return;
  }

  await MessageLog.create({ messageId: id, processed: true });

  if (!(await verificarHorarioAtencion())) {
    await sendWhatsAppMessage(
      from,
      "Lo sentimos, el restaurante está cerrado en este momento."
    );
    return;
  }

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
