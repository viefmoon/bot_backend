import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

export async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: { body: message },
    };

    const response = await axios.post(
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
  phoneNumber,
  interactiveOptions
) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: interactiveOptions,
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Respuesta de WhatsApp API:", response.data);

    const messageId = response.data.messages[0].id;
    return messageId;
  } catch (error) {
    console.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      error.response?.data || error.message
    );
    return null;
  }
}
