import { prisma } from '../server';
import { Customer } from '@prisma/client';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } from '../services/whatsapp';
import { processAndGenerateAIResponse } from '../utils/geminiProcessor';
import { PreOrderService } from '../services/preOrder';
import logger from '../utils/logger';
import { BANNED_USER_MESSAGE } from '../config/predefinedMessages';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ResponseItem {
  text?: string;
  interactiveMessage?: any;
  sendToWhatsApp: boolean;
  isRelevant: boolean;
  confirmationMessage?: string;
  preOrderId?: number;
}

export async function handleTextMessage(
  from: string,
  text: string
): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { customerId: from }
  });

  if (!customer) {
    logger.error(`Customer ${from} not found`);
    return;
  }

  if (customer.isBanned) {
    await sendWhatsAppMessage(from, BANNED_USER_MESSAGE);
    return;
  }

  const fullChatHistory: ChatMessage[] = Array.isArray(customer.fullChatHistory)
    ? (customer.fullChatHistory as unknown as ChatMessage[])
    : JSON.parse(customer.fullChatHistory as string || "[]");

  const relevantChatHistory: ChatMessage[] = Array.isArray(customer.relevantChatHistory)
    ? (customer.relevantChatHistory as unknown as ChatMessage[])
    : JSON.parse(customer.relevantChatHistory as string || "[]");

  // Check for restart phrases
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

  // Check if new conversation
  const isNewConversation = customer.lastInteraction
    ? new Date().getTime() - customer.lastInteraction.getTime() > 60 * 60 * 1000
    : true;

  if (isNewConversation || relevantChatHistory.length === 0) {
    relevantChatHistory.length = 0;
    await sendWelcomeMessage(from);
  }

  // Update chat history
  const updateChatHistory = (message: ChatMessage, isRelevant = true) => {
    fullChatHistory.push(message);
    if (isRelevant) relevantChatHistory.push(message);
  };

  updateChatHistory(
    { role: "user", content: text, timestamp: new Date() },
    true
  );

  try {
    const responses = await processAndGenerateAIResponse({
      relevantMessages: relevantChatHistory,
      conversationId: from,
    });

    // Process responses sequentially
    for (const item of responses) {
      if (item.text && item.sendToWhatsApp === true) {
        await sendWhatsAppMessage(from, item.text);
        updateChatHistory(
          { role: "assistant", content: item.text, timestamp: new Date() },
          item.isRelevant === true
        );
      }

      if (item.interactiveMessage && item.sendToWhatsApp === true) {
        const messageId = await sendWhatsAppInteractiveMessage(
          from,
          item.interactiveMessage
        );
        
        // Update preOrder with messageId if needed
        if (item.preOrderId && messageId) {
          await prisma.preOrder.update({
            where: { id: item.preOrderId },
            data: { messageId }
          });
        }

        updateChatHistory(
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

    // Update customer chat history
    await prisma.customer.update({
      where: { customerId: from },
      data: {
        fullChatHistory: JSON.stringify(fullChatHistory),
        relevantChatHistory: JSON.stringify(relevantChatHistory),
        lastInteraction: new Date()
      }
    });

  } catch (error) {
    logger.error("Error processing text message:", error);
    await sendWhatsAppMessage(
      from,
      "Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo."
    );
  }
}

async function resetChatHistory(customer: Customer) {
  await prisma.customer.update({
    where: { customerId: customer.customerId },
    data: {
      fullChatHistory: JSON.stringify([]),
      relevantChatHistory: JSON.stringify([])
    }
  });

  await sendWhatsAppMessage(
    customer.customerId,
    "🔄 He borrado el historial de nuestra conversación. ¡Empecemos de nuevo! ¿En qué puedo ayudarte?"
  );
}

async function sendWelcomeMessage(customerId: string) {
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
            { id: "view_menu", title: "Ver Menú 📋" },
            { id: "make_order", title: "Hacer un pedido 🍕" },
            { id: "wait_times", title: "Tiempos de espera ⏰" },
            { id: "restaurant_info", title: "Información y horarios 📍" },
            { id: "chatbot_help", title: "¿Cómo usar el bot? 🤖" },
          ],
        },
      ],
    },
  };

  await sendWhatsAppInteractiveMessage(customerId, listOptions);
}