import { MessageRateLimit } from "../models";
import { sendWhatsAppMessage } from "./whatsAppUtils";
import * as dotenv from "dotenv";
dotenv.config();

export async function checkMessageRateLimit(
  clientId: string
): Promise<boolean> {
  const RATE_LIMIT_MAX_MESSAGES = parseInt(
    process.env.RATE_LIMIT_MAX_MESSAGES || "30",
    10
  );
  const RATE_LIMIT_TIME_WINDOW_MINUTES = parseInt(
    process.env.RATE_LIMIT_TIME_WINDOW_MINUTES || "5",
    10
  );
  const RATE_LIMIT_TIME_WINDOW = RATE_LIMIT_TIME_WINDOW_MINUTES * 60 * 1000;

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
  const timeSinceLastMessage =
    now.getTime() - rateLimit.lastMessageTime.getTime();

  if (timeSinceLastMessage > RATE_LIMIT_TIME_WINDOW) {
    await rateLimit.update({ messageCount: 1, lastMessageTime: now });
    return false; // No limitado
  }

  if (rateLimit.messageCount >= RATE_LIMIT_MAX_MESSAGES) {
    const timeRemaining = Math.ceil(
      (RATE_LIMIT_TIME_WINDOW - timeSinceLastMessage) / 1000
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

async function sendRateLimitMessage(
  clientId: string,
  timeRemaining: number
): Promise<void> {
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
    `⚠️ Por motivos de seguridad, has alcanzado el límite de mensajes permitidos. 🛑 Por favor, espera ${timeMessage} antes de enviar más mensajes. ⏳ Agradecemos tu comprensión. 🙏`
  );
}
