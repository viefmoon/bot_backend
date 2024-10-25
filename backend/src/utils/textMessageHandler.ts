import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsAppUtils";
import { Customer, PreOrder } from "../models";
import * as dotenv from "dotenv";
import { preProcessMessages } from "./messageProcess";
import { PreOrderService } from "../services/pre-order.service";
import logger from "./logger";
import { AgentConfig, AgentType } from "src/types/agents";
dotenv.config();

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: Date;
}

interface ResponseItem {
  text?: string;
  sendToWhatsApp?: boolean;
  isRelevant?: boolean;
  confirmationMessage?: string;
  interactiveMessage?: any;
  preOrderId?: number;
}

interface ProcessRequest {
  relevantMessages: ChatMessage[];
  conversationId: string;
}

async function resetChatHistory(customer) {
  await customer.update({ relevantChatHistory: [] });
  await sendWhatsAppMessage(
    customer.clientId,
    "🔄 Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora? 😊"
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
              title: "Actualizar entrega",
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

  const fullChatHistory: ChatMessage[] = Array.isArray(customer.fullChatHistory)
    ? customer.fullChatHistory
    : JSON.parse(customer.fullChatHistory || "[]");

  const relevantChatHistory: ChatMessage[] = Array.isArray(
    customer.relevantChatHistory
  )
    ? customer.relevantChatHistory
    : JSON.parse(customer.relevantChatHistory || "[]");

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

  const isNewConversation =
    new Date().getTime() - new Date(customer.lastInteraction).getTime() >
      60 * 60 * 1000 || relevantChatHistory.length === 0;

  if (isNewConversation) {
    relevantChatHistory.length = 0;
    await sendWelcomeMessage(from);
  }

  // Función simplificada para actualizar historiales
  const updateChatHistory = (message: ChatMessage, isRelevant = true) => {
    fullChatHistory.push(message);
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

  // Procesar las respuestas secuencialmente
  for (const item of responses) {
    if (item.text && item.sendToWhatsApp === true) {
      await sendWhatsAppMessage(from, item.text);
      await updateChatHistory(
        { role: "assistant", content: item.text, timestamp: new Date() },
        item.isRelevant === true
      );
    }

    if (item.interactiveMessage && item.sendToWhatsApp === true) {
      const messageId = await sendWhatsAppInteractiveMessage(
        from,
        item.interactiveMessage
      );
      // Si hay un preOrderId en la respuesta, actualizamos la orden con el messageId
      if (item.preOrderId && messageId) {
        const preOrder = await PreOrder.findByPk(item.preOrderId);
        if (preOrder) {
          await preOrder.update({ messageId });
        }
      }

      await updateChatHistory(
        {
          role: "assistant",
          content: JSON.stringify(item.interactiveMessage),
          timestamp: new Date(),
        },
        item.isRelevant === true
      );
    }

    if (item.confirmationMessage) {
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

  const messagesWithoutTimestamp = relevantMessages.map(
    ({ role, content }) => ({
      role,
      content,
    })
  );

  const agentConfig: AgentConfig = {
    generalAgent: { type: AgentType.GENERAL_AGENT, provider: "GEMINI" },
    orderAgent: { type: AgentType.ORDER_AGENT, provider: "GEMINI" },
  };

  try {
    const aiResponses = await preProcessMessages(
      messagesWithoutTimestamp,
      agentConfig.generalAgent,
      agentConfig
    );
    const responseItems: ResponseItem[] = [];

    for (const response of aiResponses) {
      if (response.text) {
        // Si es un texto
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

        // Agregamos el mensaje de texto normal
        responseItems.push({
          text: selectProductsResponse.json.text,
          sendToWhatsApp: selectProductsResponse.json.sendToWhatsApp,
          isRelevant: selectProductsResponse.json.isRelevant,
        });

        // Agregamos el mensaje interactivo si existe
        if (selectProductsResponse.json.interactiveMessage) {
          responseItems.push({
            interactiveMessage: selectProductsResponse.json.interactiveMessage,
            sendToWhatsApp: true,
            isRelevant: false,
            preOrderId: selectProductsResponse.json.preOrderId,
          });
        }
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
