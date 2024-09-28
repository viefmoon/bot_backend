import { MessageRateLimit } from "../models";
import { sendWhatsAppMessage } from "./whatsAppUtils";

export async function checkAndHandleMessageRateLimit(clientId) {
  const MAX_MESSAGES = 30;
  const TIME_WINDOW = 5 * 60 * 1000; // 5 minutos en milisegundos

  let rateLimit = await MessageRateLimit.findOne({ where: { clientId } });

  if (!rateLimit) {
    await MessageRateLimit.create({
      clientId,
      messageCount: 1,
      lastMessageTime: new Date(),
    });
    return false; // No limitado
  }

  const now = new Date();
  const timeSinceLastMessage = now - rateLimit.lastMessageTime;

  if (timeSinceLastMessage > TIME_WINDOW) {
    await rateLimit.update({ messageCount: 1, lastMessageTime: now });
    return false; // No limitado
  }

  if (rateLimit.messageCount >= MAX_MESSAGES) {
    const timeRemaining = Math.ceil(
      (TIME_WINDOW - timeSinceLastMessage) / 1000
    );
    await sendRateLimitMessage(clientId, timeRemaining);
    return true; // Limitado
  }

  await rateLimit.update({
    messageCount: rateLimit.messageCount + 1,
    lastMessageTime: now,
  });
  return false; // No limitado
}

async function sendRateLimitMessage(clientId, timeRemaining) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeMessage =
    minutes > 0
      ? `${minutes} minuto${minutes > 1 ? "s" : ""} y ${seconds} segundo${
          seconds !== 1 ? "s" : ""
        }`
      : `${seconds} segundo${seconds !== 1 ? "s" : ""}`;

  await sendWhatsAppMessage(
    clientId,
    `Por motivos de seguridad, has alcanzado el límite de mensajes permitidos. Por favor, espera ${timeMessage} antes de enviar más mensajes. Agradecemos tu comprensión.`
  );
}