import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer } from "../models";
import * as dotenv from "dotenv";
import { preprocessMessages } from "./messagePreprocess";
import axios from "axios";
import { Anthropic } from "@anthropic-ai/sdk";

dotenv.config();

const { selectProductsToolClaude } = require("../aiTools/aiTools");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatMessage {
  role: string;
  content: string;
}

interface ResponseItem {
  text: string;
  sendToWhatsApp?: boolean;
  isRelevant?: boolean;
  confirmationMessage?: string;
}

interface PreprocessedContent {
  isDirectResponse: boolean;
  text: string;
  isRelevant: boolean;
  confirmationMessage?: string;
}

interface ProcessRequest {
  relevantMessages: ChatMessage[];
  conversationId: string;
}

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
            {
              id: "change_delivery_info",
              title: "Act. info de entrega",
            },
            { id: "reorder", title: "Reordenar" },
          ],
        },
      ],
    },
  };

  await sendWhatsAppInteractiveMessage(phoneNumber, listOptions);
}

export async function handleTextMessage(
  from: string,
  text: string
): Promise<void> {
  const customer = await Customer.findOne({
    where: { clientId: from },
  });

  let fullChatHistory: ChatMessage[] = customer.fullChatHistory || [];
  let relevantChatHistory: ChatMessage[] = customer.relevantChatHistory || [];

  if (text.toLowerCase().includes("olvida lo anterior")) {
    await resetChatHistory(customer);
    return;
  }

  if (
    new Date().getTime() - new Date(customer.lastInteraction).getTime() >
      60 * 60 * 1000 ||
    relevantChatHistory.length === 0
  ) {
    relevantChatHistory = [];
    await sendWelcomeMessage(from);
  }

  // Función para actualizar el historial de chat completo y relevante
  const updateChatHistory = (
    message: ChatMessage,
    isRelevant: boolean = true
  ): void => {
    // Agrega el mensaje al historial completo del chat
    fullChatHistory.push(message);
    // Si el mensaje es relevante, también se agrega al historial relevante
    if (isRelevant) relevantChatHistory.push(message);
  };

  updateChatHistory({ role: "user", content: text }, true);

  console.log("fullChatHistory CON EL MENSAJE", fullChatHistory);
  console.log("relevantChatHistory CON EL MENSAJE", relevantChatHistory);

  const response = await processAndGenerateAIResponse({
    relevantMessages: relevantChatHistory,
    conversationId: from,
  });

  for (const item of response) {
    if (item.text) {
      if (item.sendToWhatsApp == true) {
        await sendWhatsAppMessage(from, item.text);
      }
      updateChatHistory(
        { role: "assistant", content: item.text },
        item.isRelevant == true
      );
    }

    if (item.confirmationMessage) {
      await sendWhatsAppMessage(from, item.confirmationMessage);
      updateChatHistory(
        {
          role: "assistant",
          content: item.confirmationMessage,
        },
        true
      );
    }
  }

  console.log("fullChatHistory", fullChatHistory);
  console.log("relevantChatHistory", relevantChatHistory);

  await customer.update({
    fullChatHistory: fullChatHistory,
    relevantChatHistory: relevantChatHistory,
    lastInteraction: new Date(),
  });
}

async function processAndGenerateAIResponse(
  req: ProcessRequest
): Promise<ResponseItem[]> {
  const { relevantMessages, conversationId } = req;

  console.log("relevantMessages", relevantMessages);
  try {
    const preprocessedContent: PreprocessedContent = (await preprocessMessages(
      relevantMessages
    )) as any;

    if (preprocessedContent.isDirectResponse) {
      return [
        {
          text: preprocessedContent.text,
          sendToWhatsApp: true,
          isRelevant: preprocessedContent.isRelevant,
          confirmationMessage: preprocessedContent.confirmationMessage,
        },
      ];
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
      messages: [
        { role: "user", content: JSON.stringify(preprocessedContent) },
      ],
      max_tokens: 4096,
      tools: [selectProductsToolClaude],
      tool_choice: { type: "tool", name: "select_products" },
    });

    if (
      response.content &&
      response.content[0]?.type === "tool_use" &&
      response.content[0]?.name === "select_products"
    ) {
      const { orderItems, orderType, scheduledDeliveryTime } = response
        .content[0].input as any;

      try {
        const selectProductsResponse = (await axios.post(
          `${process.env.BASE_URL}/api/orders/select_products`,
          {
            orderItems,
            clientId: conversationId,
            orderType,
            scheduledDeliveryTime,
          }
        )) as any;

        return [
          {
            text: selectProductsResponse.data.mensaje,
            sendToWhatsApp: false,
            isRelevant: true,
          },
        ];
      } catch (error) {
        console.error("Error al seleccionar los productos:", error);
        const errorMessage =
          (error as any).response?.data?.error ||
          "Error al procesar tu pedido. Por favor, inténtalo de nuevo.";
        return [{ text: errorMessage, sendToWhatsApp: true, isRelevant: true }];
      }
    }

    return [
      {
        text: "No se pudo procesar la solicitud correctamente.",
        sendToWhatsApp: true,
        isRelevant: true,
      },
    ];
  } catch (error) {
    console.error("Error general:", error);
    return [
      {
        text: "Error al procesar la solicitud: " + (error as Error).message,
        sendToWhatsApp: true,
        isRelevant: true,
      },
    ];
  }
}
