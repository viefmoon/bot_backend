import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import logger from "./logger";
import {
  WhatsAppMessage,
  WhatsAppInteractiveMessage,
  WhatsAppInteractiveContent,
} from "../types/whatsapp.types";
import NotificationPhone from "../models/notificationPhone";

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<string[] | null> {
  // Cambiar el tipo de retorno a un array de strings
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
    logger.error("Error al enviar mensaje de WhatsApp:", error);
    return null;
  }
}

export async function sendWhatsAppInteractiveMessage(
  phoneNumber: string,
  interactiveOptions: WhatsAppInteractiveContent // Reemplazamos 'any' por la interfaz específica
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
    logger.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      (error as Error).message
    );
    return null;
  }
}

export async function sendWhatsAppNotification(
  message: string
): Promise<Array<{ phoneNumber: string; messageIds: string[] | null }>> {
  try {
    const activePhones = await NotificationPhone.findAll({
      where: { isActive: true },
      attributes: ["phoneNumber"],
    });
    console.log("activePhones", activePhones);

    const results = await Promise.all(
      activePhones.map(async (phone) => {
        const messageIds: string[] = [];
        let remainingMessage = message;

        while (remainingMessage.length > 4096) {
          const part = remainingMessage.slice(0, 4096);
          remainingMessage = remainingMessage.slice(4096);

          const payload: WhatsAppMessage = {
            messaging_product: "whatsapp",
            to: phone.phoneNumber,
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

        if (remainingMessage.length > 0) {
          const payload: WhatsAppMessage = {
            messaging_product: "whatsapp",
            to: phone.phoneNumber,
            type: "text",
            text: { body: remainingMessage },
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

        return { phoneNumber: phone.phoneNumber, messageIds };
      })
    );

    return results;
  } catch (error) {
    logger.error("Error al enviar notificación de WhatsApp:", error);
    return [];
  }
}

export async function sendWhatsAppInteractiveNotification(
  interactiveOptions: WhatsAppInteractiveContent
): Promise<Array<{ phoneNumber: string; messageId: string | null }>> {
  try {
    const activePhones = await NotificationPhone.findAll({
      where: { isActive: true },
      attributes: ["phoneNumber"],
    });

    const results = await Promise.all(
      activePhones.map(async (phone) => {
        const payload: WhatsAppInteractiveMessage = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.phoneNumber,
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

        return {
          phoneNumber: phone.phoneNumber,
          messageId: response.data.messages[0].id,
        };
      })
    );

    return results;
  } catch (error) {
    logger.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      (error as Error).message
    );
    return [];
  }
}
