dotenv.config();
import axios from "axios";

async function sendWhatsAppMessage(phoneNumber, message, listOptions = null) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: listOptions ? "interactive" : "text",
      text: listOptions ? undefined : { body: message },
      interactive: listOptions
        ? {
            type: "list",
            ...listOptions,
          }
        : undefined,
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

    const messageId = response.data.messages[0].id;
    return messageId;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return null;
  }
}

async function sendWhatsAppInteractiveMessage(phoneNumber, listOptions) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "list",
        ...listOptions,
      },
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
    console.log("Mensaje interactivo con imagen enviado exitosamente");
    return true;
  } catch (error) {
    console.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      error.response?.data || error.message
    );
    return false;
  }
}

export { sendWhatsAppMessage, sendWhatsAppInteractiveMessage };
