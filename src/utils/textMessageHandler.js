import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer } from "../models";
import dotenv from "dotenv";
import { preprocessMessages } from "./messagePreprocess";
import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";

dotenv.config();

const { selectProductsToolClaude } = require("../aiTools/aiTools");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
            { id: "chatbot_help", title: "¿Cómo usar el bot?" },
            { id: "reorder", title: "Reordenar" },
          ],
        },
      ],
    },
  };

  await sendWhatsAppInteractiveMessage(phoneNumber, listOptions);
}

export async function handleTextMessage(from, text) {

  const [customer] = await Customer.findOrCreate({
    where: { clientId: from },
    defaults: {
      fullChatHistory: "[]",
      relevantChatHistory: "[]",
      lastInteraction: new Date(),
    },
  });

  let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
  let relevantChatHistory = JSON.parse(customer.relevantChatHistory || "[]");

  // Manejar casos especiales
  if (text.toLowerCase().includes("olvida lo anterior")) {
    await resetChatHistory(customer);
    return;
  }

  if (new Date() - new Date(customer.lastInteraction) > 60 * 60 * 1000) {
    relevantChatHistory = [];
    await sendWelcomeMessage(from);
  }

  console.log("Mensaje recibido:", text);

  // Función para actualizar el historial de chat
  const updateChatHistory = (message, isRelevant = true) => {
    fullChatHistory.push(message);
    if (isRelevant) relevantChatHistory.push(message);
  };

  updateChatHistory({ role: "user", content: text });

  const response = await processAndGenerateAIResponse({
    relevantMessages: relevantChatHistory,
    conversationId: from,
  });

  if (response.text && response.text.trim() !== "") {
    if (response.sendToWhatsApp !== false) {
      await sendWhatsAppMessage(from, response.text);
    }
    updateChatHistory({ role: "assistant", content: response.text }, response.isRelevant !== false);

    if (response.confirmationMessage) {
      await sendWhatsAppMessage(from, response.confirmationMessage);
      updateChatHistory({ role: "assistant", content: response.confirmationMessage });
    }
  }

  console.log("relevantChatHistory", relevantChatHistory);

  await customer.update({
    fullChatHistory: JSON.stringify(fullChatHistory),
    relevantChatHistory: JSON.stringify(relevantChatHistory),
    lastInteraction: new Date(),
  });
}

async function processAndGenerateAIResponse(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const preprocessedContent = await preprocessMessages(relevantMessages);

    if (preprocessedContent.isDirectResponse) {
      return [{
        text: preprocessedContent.text,
        sendToWhatsApp: true,
        isRelevant: preprocessedContent.isRelevant,
        confirmationMessage: preprocessedContent.confirmationMessage,
      }];
    }

    const systemContent = [
      "Basándote en el objeto proporcionado, utiliza la función `select_products`",
      "- Utiliza los `relevantMenuItems` proporcionados para mapear las descripciones de los productos a sus respectivos IDs.",
      "- No es necesario usar todos los relevantMenuItems si no aplican",
      "- Es OBLIGATORIO usar la función `select_products` para completar esta tarea.",
    ].join("\n");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      system: systemContent,
      messages: [{ role: "user", content: JSON.stringify(preprocessedContent) }],
      max_tokens: 4096,
      tools: [selectProductsToolClaude],
      tool_choice: { type: "tool", name: "select_products" },
    });

    if (response.content && response.content[0]?.type === "tool_use" && response.content[0]?.name === "select_products") {
      const { orderItems, orderType, deliveryInfo, scheduledDeliveryTime } = response.content[0].input;
      
      try {
        const selectProductsResponse = await axios.post(
          `${process.env.BASE_URL}/api/orders/select_products`,
          { orderItems, clientId: conversationId, orderType, deliveryInfo, scheduledDeliveryTime }
        );

        return [{ text: selectProductsResponse.data.mensaje, sendToWhatsApp: false, isRelevant: true }];
      } catch (error) {
        console.error("Error al seleccionar los productos:", error);
        const errorMessage = error.response?.data?.error || "Error al procesar tu pedido. Por favor, inténtalo de nuevo.";
        return [{ text: errorMessage, sendToWhatsApp: true, isRelevant: true }];
      }
    }

    return [{ text: "No se pudo procesar la solicitud correctamente.", sendToWhatsApp: true, isRelevant: true }];

  } catch (error) {
    console.error("Error general:", error);
    return [{
      text: "Error al procesar la solicitud: " + error.message,
      sendToWhatsApp: true,
      isRelevant: true,
    }];
  }
}
