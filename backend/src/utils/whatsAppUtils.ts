import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import logger from "./logger";
import {
  WhatsAppMessage,
  WhatsAppInteractiveMessage,
  WhatsAppInteractiveContent,
} from "../types/whatsapp.types";

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<string[] | null> {
  try {
    const messageIds: string[] = []; // Array para almacenar los IDs de los mensajes enviados

    while (message.length > 4096) {
      const part = message.slice(0, 4096); // Obtener la primera parte del mensaje
      message = message.slice(4096); // Reducir el mensaje original

      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: part },
      };

      const response = await axios.post<{ messages: [{ id: string }] }>(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      messageIds.push(response.data.messages[0].id); // Almacenar el ID del mensaje enviado
    }

    // Enviar el mensaje restante si hay
    if (message.length > 0) {
      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: message },
      };

      const response = await axios.post<{ messages: [{ id: string }] }>(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      messageIds.push(response.data.messages[0].id);
    }

    return messageIds; // Retornar los IDs de todos los mensajes enviados
  } catch (error) {
    logger.error("Error al enviar mensaje de WhatsApp:", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function sendWhatsAppInteractiveMessage(
  phoneNumber: string,
  interactiveOptions: WhatsAppInteractiveContent
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
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID}/messages`,
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
    logger.error("Error al enviar mensaje interactivo de WhatsApp:", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function sendWhatsAppNotification(
  phoneNumber: string,
  message: string
): Promise<string[] | null> {
  try {
    const messageIds: string[] = [];

    while (message.length > 4096) {
      const part = message.slice(0, 4096);
      message = message.slice(4096);

      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: part },
      };

      const response = await axios.post<{ messages: [{ id: string }] }>(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_NOTIFICATION_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      messageIds.push(response.data.messages[0].id);
    }

    if (message.length > 0) {
      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: message },
      };

      const response = await axios.post<{ messages: [{ id: string }] }>(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_NOTIFICATION_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      messageIds.push(response.data.messages[0].id);
    }

    return messageIds;
  } catch (error) {
    logger.error("Error al enviar notificación de WhatsApp:", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function sendWhatsAppInteractiveNotification(
  phoneNumber: string,
  interactiveOptions: WhatsAppInteractiveContent
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
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_NOTIFICATION_ID}/messages`,
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
    logger.error("Error al enviar mensaje interactivo de WhatsApp:", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
