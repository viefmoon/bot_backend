import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text: { body: string };
}

interface WhatsAppInteractiveMessage {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  interactive: any; // Tipo 'any' usado aquí, pero se podría definir una interfaz más específica si se conoce la estructura exacta
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<string | null> {
  try {
    const payload: WhatsAppMessage = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: { body: message },
    };

    const response = await axios.post<{ messages: [{ id: string }] }>(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.messages[0].id;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return null;
  }
}

export async function sendWhatsAppInteractiveMessage(
  phoneNumber: string,
  interactiveOptions: any // Tipo 'any' usado aquí, pero se podría definir un tipo más específico si se conoce la estructura exacta
): Promise<string | null> {
  try {
    const payload: WhatsAppInteractiveMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: interactiveOptions,
    };

    const response = await axios.post<{ messages: [{ id: string }] }>(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.messages[0].id;
  } catch (error) {
    console.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      (error as Error).message
    );
    return null;
  }
}
