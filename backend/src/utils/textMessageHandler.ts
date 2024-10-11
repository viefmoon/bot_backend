import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer } from "../models";
import * as dotenv from "dotenv";
import { preprocessMessages } from "./messagePreprocess";
import { Anthropic } from "@anthropic-ai/sdk";
import { PreOrderService } from "../services/pre-order.service";
import { SYSTEM_MESSAGE_PHASE_2 } from "../config/predefinedMessages";

dotenv.config();

const { selectProductsToolClaude } = require("../aiTools/aiTools");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatMessage {
  role: string;
  content: string;
  timestamp: Date;
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
  await customer.update({ relevantChatHistory: [] });
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
      text: "Bienvenido a La Leña 🪵🔥",
    },
    body: {
      text: "¿Cómo podemos ayudarte hoy? 😊",
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

  let fullChatHistory: ChatMessage[] = [];
  if (Array.isArray(customer.fullChatHistory)) {
    fullChatHistory = customer.fullChatHistory;
  } else if (typeof customer.fullChatHistory === "string") {
    fullChatHistory = JSON.parse(customer.fullChatHistory);
  }

  let relevantChatHistory: ChatMessage[] = [];
  if (Array.isArray(customer.relevantChatHistory)) {
    relevantChatHistory = customer.relevantChatHistory;
  } else if (typeof customer.relevantChatHistory === "string") {
    relevantChatHistory = JSON.parse(customer.relevantChatHistory);
  }
  const restartPhrases = [
    "olvida lo anterior",
    "reinicia la conversación",
    "borra el historial",
    "empecemos de nuevo",
    "olvida todo",
    "reinicia el chat",
  ];

  if (restartPhrases.some((phrase) => text.toLowerCase().includes(phrase))) {
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

  updateChatHistory(
    { role: "user", content: text, timestamp: new Date() },
    true
  );

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
        { role: "assistant", content: item.text, timestamp: new Date() },
        item.isRelevant == true
      );
    }

    if (item.confirmationMessage) {
      await sendWhatsAppMessage(from, item.confirmationMessage);
      updateChatHistory(
        {
          role: "assistant",
          content: item.confirmationMessage,
          timestamp: new Date(),
        },
        true
      );
    }
  }

  await customer.update({
    fullChatHistory: JSON.stringify(fullChatHistory),
    relevantChatHistory: JSON.stringify(relevantChatHistory),
  });
}

async function processAndGenerateAIResponse(
  req: ProcessRequest
): Promise<ResponseItem[]> {
  const { relevantMessages, conversationId } = req;

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
    console.log(preprocessedContent);

    // const preOrderService = new PreOrderService();
    // const selectProductsResponse = await preOrderService.selectProducts({
    //   orderItems,
    //   clientId: conversationId,
    //   orderType,
    //   scheduledDeliveryTime,
    // });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      system: SYSTEM_MESSAGE_PHASE_2,
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
        const preOrderService = new PreOrderService();
        const selectProductsResponse = await preOrderService.selectProducts({
          orderItems,
          clientId: conversationId,
          orderType,
          scheduledDeliveryTime,
        });

        return [
          {
            text: selectProductsResponse.json.mensaje,
            sendToWhatsApp: false,
            isRelevant: true,
          },
        ];
      } catch (error) {
        console.error("Error al seleccionar los productos:", error);
        const errorMessage =
          error.message ||
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
