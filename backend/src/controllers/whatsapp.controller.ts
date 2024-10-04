import { Controller, Post, Body } from "@nestjs/common";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";

@Controller("whatsapp")
export class WhatsAppController {
  @Post("send-message")
  async sendMessage(@Body() messageData: { to: string; message: string }) {
    const { to, message } = messageData;
    try {
      const messageId = await sendWhatsAppMessage(to, message);
      if (messageId) {
        return {
          success: true,
          messageId,
          message: "Mensaje enviado con éxito",
        };
      } else {
        return { success: false, message: "Error al enviar el mensaje" };
      }
    } catch (error) {
      console.error("Error al enviar mensaje de WhatsApp:", error);
      return { success: false, message: "Error al enviar el mensaje" };
    }
  }
}
