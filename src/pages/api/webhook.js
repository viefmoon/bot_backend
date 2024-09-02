const axios = require("axios");

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Verificación del webhook
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("Mode:", mode);
    console.log("Token:", token);
    console.log("Challenge:", challenge);
    console.log("Expected token:", process.env.WHATSAPP_VERIFY_TOKEN);

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verificado exitosamente");
      res.status(200).send(challenge);
    } else {
      console.error("Fallo en la verificación del webhook");
      res.status(403).end();
    }
  } else if (req.method === "POST") {
    const { object, entry } = req.body;

    if (object === "whatsapp_business_account") {
      for (const entryItem of entry) {
        const { changes } = entryItem;
        for (const change of changes) {
          const { value } = change;
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const { from, text } = message;
              console.log(`Mensaje recibido de ${from}: ${text.body}`);

              // Aquí procesamos el mensaje
              await handleMessage(from, text.body);
            }
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.sendStatus(404);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}

async function handleMessage(from, message) {
  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/chat`,
      {
        message: [{ role: "user", content: message }],
        conversationId: `${process.env.CONVERSATION_ID_PREFIX}${from}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    await sendWhatsAppMessage(from, response.data);
  } catch (error) {
    console.error("Error al procesar el mensaje:", error);
  }
}

async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: {
        body: message,
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Mensaje enviado exitosamente");
    return true;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return false;
  }
}
