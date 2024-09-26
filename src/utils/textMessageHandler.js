import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer, MessageRateLimit } from "../models";
import { handleChatRequest } from "../pages/api/handleChatRequest";

async function resetChatHistory(customer) {
  await customer.update({ relevantChatHistory: "[]" });
  await sendWhatsAppMessage(
    customer.clientId,
    "Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora?"
  );
}

async function sendWelcomeMessage(phoneNumber) {
  const listOptions = {
    type: "list",
    header: {
      type: "text",
      text: "Bienvenido a La Leña",
    },
    body: {
      text: "¿Cómo podemos ayudarte hoy?",
    },
    footer: {
      text: "Selecciona una opción:",
    },
    action: {
      button: "Ver opciones",
      sections: [
        {
          title: "Acciones",
          rows: [
            { id: "view_menu", title: "Ver Menú" },
            { id: "wait_times", title: "Tiempos de espera" },
            { id: "restaurant_info", title: "Información y horarios" },
          ],
        },
      ],
    },
  };

  await sendWhatsAppInteractiveMessage(phoneNumber, listOptions);
}
async function checkMessageRateLimit(clientId) {
  const MAX_MESSAGES = 30;
  const TIME_WINDOW = 5 * 60 * 1000;

  let rateLimit = await MessageRateLimit.findOne({ where: { clientId } });

  if (!rateLimit) {
    await MessageRateLimit.create({
      clientId,
      messageCount: 1,
      lastMessageTime: new Date(),
    });
    return false;
  }

  const now = new Date();
  const timeSinceLastMessage = now - rateLimit.lastMessageTime;

  if (timeSinceLastMessage > TIME_WINDOW) {
    await rateLimit.update({ messageCount: 1, lastMessageTime: now });
    return false;
  }

  if (rateLimit.messageCount >= MAX_MESSAGES) {
    return true;
  }

  await rateLimit.update({
    messageCount: rateLimit.messageCount + 1,
    lastMessageTime: now,
  });
  return false;
}

export async function handleTextMessage(from, text) {
  if (await checkMessageRateLimit(from)) {
    await sendWhatsAppMessage(
      from,
      "Has enviado demasiados mensajes. Por favor, espera un momento."
    );
    return;
  }

  const [customer, created] = await Customer.findOrCreate({
    where: { clientId: from },
    defaults: {
      fullChatHistory: "[]",
      relevantChatHistory: "[]",
      lastInteraction: new Date(),
    },
  });

  let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
  let relevantChatHistory = JSON.parse(customer.relevantChatHistory || "[]");

  if (new Date() - new Date(customer.lastInteraction) > 60 * 60 * 1000) {
    relevantChatHistory = [];
  }
  console.log("Mensaje recibido:", text);

  if (text.toLowerCase().includes("olvida lo anterior")) {
    await resetChatHistory(customer);
    return;
  }

  if (relevantChatHistory.length === 0) {
    await sendWelcomeMessage(from);
  }

  const userMessage = { role: "user", content: text };
  fullChatHistory.push(userMessage);
  relevantChatHistory.push(userMessage);

  const response = await handleChatRequest({
    relevantMessages: relevantChatHistory,
    conversationId: from,
  });

  if (Array.isArray(response)) {
    for (const msg of response) {
      if (msg.text && msg.text.trim() !== "") {
        if (msg.sendToWhatsApp !== false) {
          await sendWhatsAppMessage(from, msg.text);
        }
        const assistantMessage = { role: "assistant", content: msg.text };
        fullChatHistory.push(assistantMessage);
        if (msg.isRelevant !== false) {
          relevantChatHistory.push(assistantMessage);
        }
        // Enviar mensaje de confirmación si existe
        if (msg.confirmationMessage) {
          await sendWhatsAppMessage(from, msg.confirmationMessage);
          const confirmationAssistantMessage = {
            role: "assistant",
            content: msg.confirmationMessage,
          };
          fullChatHistory.push(confirmationAssistantMessage);
          relevantChatHistory.push(confirmationAssistantMessage);
        }
      }
    }
  } else {
    if (response.text && response.text.trim() !== "") {
      if (response.sendToWhatsApp !== false) {
        await sendWhatsAppMessage(from, response.text);
      }
      const assistantMessage = {
        role: "assistant",
        content: response.text,
      };
      fullChatHistory.push(assistantMessage);
      if (response.isRelevant !== false) {
        relevantChatHistory.push(assistantMessage);
      }
      // Enviar mensaje de confirmación si existe
      if (response.confirmationMessage) {
        await sendWhatsAppMessage(from, response.confirmationMessage);
        const confirmationAssistantMessage = {
          role: "assistant",
          content: response.confirmationMessage,
        };
        fullChatHistory.push(confirmationAssistantMessage);
        relevantChatHistory.push(confirmationAssistantMessage);
      }
    }
  }

  console.log("relevantChatHistory", relevantChatHistory);

  await customer.update({
    fullChatHistory: JSON.stringify(fullChatHistory),
    relevantChatHistory: JSON.stringify(relevantChatHistory),
    lastInteraction: new Date(),
  });
}
