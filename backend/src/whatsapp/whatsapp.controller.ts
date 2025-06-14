import { Controller, Post, Body } from "@nestjs/common";
import {
  sendWhatsAppMessage,
  sendWelcomeMessage,
} from "./utils/whatsapp.utils";
import logger from "../common/utils/logger";

@Controller("whatsapp")
export class WhatsAppController {
  @Post("send-message")
  async sendMessage(@Body() messageData: { to: string; message: string }) {
    const { to, message } = messageData;
    try {
      const messageId = await sendWhatsAppMessage(to, message);
      await sendWelcomeMessage(to);
      if (messageId) {
        return {
          success: true,
          messageId,
          message: "Mensaje enviado con éxito",
        };
      } else {
        logger.error("Error al enviar el mensaje de WhatsApp");
        return { success: false, message: "Error al enviar el mensaje" };
      }
    } catch (error) {
      logger.error(`Error al enviar mensaje de WhatsApp: ${error.message}`, {
        error,
      });
      return { success: false, message: "Error al enviar el mensaje" };
    }
  }
}
