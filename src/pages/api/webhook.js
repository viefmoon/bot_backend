const { handleChatRequest } = require("./chat");
const Customer = require("../../models/customer");

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
    // Buscar o crear el cliente
    let [customer, created] = await Customer.findOrCreate({
      where: { clientId: from },
      defaults: { fullChatHistory: "[]", relevantChatHistory: "[]" },
    });

    // Obtener y parsear los historiales de chat
    let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
    let relevantChatHistory = JSON.parse(customer.relevantChatHistory || "[]");

    // Añadir el nuevo mensaje del usuario a ambos historiales
    const userMessage = { role: "user", content: message };
    fullChatHistory.push(userMessage);
    relevantChatHistory.push(userMessage);

    // Llamar directamente a la función del manejador en chat.js
    const response = await handleChatRequest({
      messages: relevantChatHistory,
      conversationId: from,
    });

    // Procesar y enviar respuestas
    if (Array.isArray(response)) {
      for (const msg of response) {
        await sendWhatsAppMessage(from, msg.text);
        const assistantMessage = { role: "assistant", content: msg.text };
        fullChatHistory.push(assistantMessage);
        if (msg.isRelevant !== false) {
          // Si no contiene isRelevant o es true
          relevantChatHistory.push(assistantMessage);
        }
      }
    } else {
      await sendWhatsAppMessage(from, response.text);
      const assistantMessage = {
        role: "assistant",
        content: response.text,
      };
      fullChatHistory.push(assistantMessage);
      if (response.isRelevant !== false) {
        // Si no contiene isRelevant o es true
        relevantChatHistory.push(assistantMessage);
      }
    }

    // Actualizar los historiales de chat en la base de datos
    await customer.update({
      fullChatHistory: JSON.stringify(fullChatHistory),
      relevantChatHistory: JSON.stringify(relevantChatHistory),
    });
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
