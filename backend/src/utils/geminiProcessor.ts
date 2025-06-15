import { GoogleGenerativeAI } from '@google/generative-ai';
import { PreOrderService } from '../services/preOrder';
import { sendWhatsAppMessage } from '../services/whatsapp';
import logger from './logger';
import { 
  ROUTER_AGENT_GEMINI, 
  ORDER_MAPPER_AGENT_GEMINI, 
  QUERY_AGENT_GEMINI 
} from '../config/agentsGemini';
import { AgentType } from '../types/agents';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface ProcessRequest {
  relevantMessages: Array<{ role: string; content: string }>;
  conversationId: string;
}

interface ResponseItem {
  text?: string;
  interactiveMessage?: any;
  sendToWhatsApp: boolean;
  isRelevant: boolean;
  confirmationMessage?: string;
  preOrderId?: number;
  preprocessedContent?: any;
}

export async function processAndGenerateAIResponse(
  req: ProcessRequest
): Promise<ResponseItem[]> {
  const { relevantMessages, conversationId } = req;

  try {
    // Step 1: Route to appropriate agent
    const routerResponse = await callRouterAgent(relevantMessages);
    
    if (!routerResponse.targetAgent) {
      return [{
        text: "No pude entender tu solicitud. ¿Podrías reformularla?",
        sendToWhatsApp: true,
        isRelevant: false
      }];
    }

    // Step 2: Process based on target agent
    if (routerResponse.targetAgent === AgentType.QUERY_AGENT) {
      const queryResponse = await callQueryAgent(relevantMessages);
      return [{
        text: queryResponse,
        sendToWhatsApp: true,
        isRelevant: true
      }];
    } else if (routerResponse.targetAgent === AgentType.ORDER_MAPPER_AGENT) {
      const orderResponse = await callOrderMapperAgent(
        relevantMessages, 
        routerResponse.orderDetails
      );
      
      if (!orderResponse.orderItems || orderResponse.orderItems.length === 0) {
        return [{
          text: "No pude identificar productos válidos en tu pedido. Por favor, especifica qué deseas ordenar.",
          sendToWhatsApp: true,
          isRelevant: true
        }];
      }

      // Send warnings if any
      const responseItems: ResponseItem[] = [];
      
      if (orderResponse.warnings && orderResponse.warnings.length > 0) {
        const warningMessage = "📝 Observaciones:\n" + orderResponse.warnings.join("\n");
        await sendWhatsAppMessage(conversationId, warningMessage);
      }

      // Create pre-order
      const preOrderService = new PreOrderService();
      const selectProductsResponse = await preOrderService.selectProducts({
        orderItems: orderResponse.orderItems,
        customerId: conversationId,
        orderType: orderResponse.orderType || 'delivery',
        scheduledDeliveryTime: orderResponse.scheduledDeliveryTime
      });

      // Add text response
      responseItems.push({
        text: selectProductsResponse.json.text,
        sendToWhatsApp: selectProductsResponse.json.sendToWhatsApp,
        isRelevant: selectProductsResponse.json.isRelevant
      });

      // Add interactive message if exists
      if (selectProductsResponse.json.interactiveMessage) {
        responseItems.push({
          interactiveMessage: selectProductsResponse.json.interactiveMessage,
          sendToWhatsApp: true,
          isRelevant: false,
          preOrderId: selectProductsResponse.json.preOrderId
        });
      }

      return responseItems;
    }

    return [{
      text: "Ocurrió un error procesando tu solicitud.",
      sendToWhatsApp: true,
      isRelevant: false
    }];

  } catch (error) {
    logger.error("Error in AI processing:", error);
    return [{
      text: "Error al procesar la solicitud: " + (error as Error).message,
      sendToWhatsApp: true,
      isRelevant: true
    }];
  }
}

async function callRouterAgent(messages: Array<{ role: string; content: string }>): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: ROUTER_AGENT_GEMINI.model,
      tools: ROUTER_AGENT_GEMINI.tools,
      ...(ROUTER_AGENT_GEMINI.toolConfig && { toolConfig: ROUTER_AGENT_GEMINI.toolConfig })
    });

    const systemMessage = typeof ROUTER_AGENT_GEMINI.systemMessage === 'function' 
      ? await ROUTER_AGENT_GEMINI.systemMessage() 
      : ROUTER_AGENT_GEMINI.systemMessage;
    
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemMessage }] },
        { role: 'model', parts: [{ text: 'Entendido. Analizaré los mensajes y determinaré el agente apropiado.' }] }
      ]
    });

    // Send only the last user message for routing
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const result = await chat.sendMessage(lastUserMessage.content);
    const response = await result.response;
    
    // Extract function call
    const functionCall = response.functionCalls()?.[0];
    if (functionCall && functionCall.name === 'route_to_agent') {
      return functionCall.args;
    }

    return {};
  } catch (error) {
    logger.error('Router agent error:', error);
    throw error;
  }
}

async function callOrderMapperAgent(
  messages: Array<{ role: string; content: string }>,
  orderDetails: any[]
): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: ORDER_MAPPER_AGENT_GEMINI.model,
      tools: ORDER_MAPPER_AGENT_GEMINI.tools,
      ...(ORDER_MAPPER_AGENT_GEMINI.toolConfig && { toolConfig: ORDER_MAPPER_AGENT_GEMINI.toolConfig })
    });

    const systemMessage = typeof ORDER_MAPPER_AGENT_GEMINI.systemMessage === 'function' 
      ? await ORDER_MAPPER_AGENT_GEMINI.systemMessage() 
      : ORDER_MAPPER_AGENT_GEMINI.systemMessage;
    
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemMessage }] },
        { role: 'model', parts: [{ text: 'Entendido. Mapearé los productos solicitados al menú disponible.' }] }
      ]
    });

    // Prepare order details message
    const orderDetailsText = orderDetails.map(item => 
      `${item.quantity} x ${item.description}`
    ).join('\n');

    const result = await chat.sendMessage(
      `Por favor mapea estos productos al menú:\n${orderDetailsText}`
    );
    
    const response = await result.response;
    
    // Extract function call
    const functionCall = response.functionCalls()?.[0];
    if (functionCall && functionCall.name === 'confirm_order') {
      return functionCall.args;
    }

    return { orderItems: [] };
  } catch (error) {
    logger.error('Order mapper agent error:', error);
    throw error;
  }
}

async function callQueryAgent(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: QUERY_AGENT_GEMINI.model
    });

    const systemMessage = typeof QUERY_AGENT_GEMINI.systemMessage === 'function' 
      ? await QUERY_AGENT_GEMINI.systemMessage() 
      : QUERY_AGENT_GEMINI.systemMessage;
    
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemMessage }] },
        { role: 'model', parts: [{ text: 'Hola! Estoy aquí para ayudarte con información sobre nuestro menú y servicios.' }] }
      ]
    });

    // Get conversation context
    const conversationContext = messages.map(m => 
      `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
    ).join('\n');

    const result = await chat.sendMessage(conversationContext);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    logger.error('Query agent error:', error);
    return 'Lo siento, tuve un problema al procesar tu consulta. ¿Podrías intentar de nuevo?';
  }
}