import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer } from "../models";
import * as dotenv from "dotenv";
import {
  preprocessMessagesClaude,
  preprocessMessagesGPT,
} from "./messagePreprocess";
import { PreOrderService } from "../services/pre-order.service";
import logger from "./logger";
dotenv.config();

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
  orderItems: any[];
  orderType: string;
  scheduledDeliveryTime?: string | Date;
  text: string;
  isRelevant: boolean;
  warnings?: string[];
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
    "Entendido, he olvidado el contexto anterior. En qué puedo ayudarte ahora?"
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

  const responses = await processAndGenerateAIResponse({
    relevantMessages: relevantChatHistory,
    conversationId: from,
  });

  // Convertir responses a array y ordenar por índice
  const sortedResponses = Object.entries(responses)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([_, value]) => value);

  for (const item of sortedResponses) {
    if (item.text && item.sendToWhatsApp === true) {
      // Enviar mensaje primero
      await sendWhatsAppMessage(from, item.text);
      // Actualizar historial después
      await updateChatHistory(
        { role: "assistant", content: item.text, timestamp: new Date() },
        item.isRelevant === true
      );
    }

    if (item.confirmationMessage) {
      // Enviar mensaje de confirmación después
      await sendWhatsAppMessage(from, item.confirmationMessage);
      await updateChatHistory(
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
    const aiResponses = await preprocessMessagesClaude(relevantMessages);
    const responseItems: ResponseItem[] = [];

    for (const response of aiResponses) {
      if (response.text) {
        // Si es una respuesta directa de texto
        responseItems.push({
          text: response.text,
          sendToWhatsApp: true,
          isRelevant: response.isRelevant,
          confirmationMessage: response.confirmationMessage,
        });
      } else if (response.preprocessedContent) {
        // Si es contenido preprocesado
        if (
          response.preprocessedContent.warnings &&
          response.preprocessedContent.warnings.length > 0
        ) {
          const warningMessage =
            "📝 Observaciones:\n" +
            response.preprocessedContent.warnings.join("\n");
          await sendWhatsAppMessage(conversationId, warningMessage);
        }

        const preOrderService = new PreOrderService();
        const selectProductsResponse = await preOrderService.selectProducts({
          orderItems: response.preprocessedContent.orderItems,
          clientId: conversationId,
          orderType: response.preprocessedContent.orderType,
          scheduledDeliveryTime:
            response.preprocessedContent.scheduledDeliveryTime,
        });

        responseItems.push({
          text: selectProductsResponse.json.text,
          sendToWhatsApp: selectProductsResponse.json.sendToWhatsApp,
          isRelevant: true,
        });
      }
    }

    return responseItems;
  } catch (error) {
    logger.error("Error general:", error);
    return [
      {
        text: "Error al procesar la solicitud: " + (error as Error).message,
        sendToWhatsApp: true,
        isRelevant: true,
      },
    ];
  }
}
