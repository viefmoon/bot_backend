import { MessageContext } from './MessageContext';
import { AgentService } from '../ai';
import { PreOrderWorkflowService } from '../orders/PreOrderWorkflowService';
import { sendWhatsAppMessage } from '../whatsapp';
import { getToolHandler } from '../ai/tools/toolHandlers';
import { ResponseBuilder, ResponseType, UnifiedResponse } from './types/responses';
import { CONTEXT_KEYS } from '../../common/constants';
import logger from '../../common/utils/logger';
import { ProcessedOrderData } from '../../common/types/preorder.types';
import { ValidationError, BusinessLogicError, TechnicalError, ErrorCode } from '../../common/services/errors';

// Type definition for content
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export class TextProcessingService {
  /**
   * Process text input through the AI agent system
   * This can be called by any strategy that needs to process text
   */
  static async processTextMessage(
    text: string,
    context: MessageContext
  ): Promise<void> {
    if (!context.customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found in context'
      );
    }

    // El historial que viene en el contexto YA incluye el mensaje actual del usuario,
    // preparado y ordenado por el worker.
    const relevantChatHistory = context.get(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY) || [];
    
    try {
      // Usamos 'relevantChatHistory' directamente - ya incluye el mensaje actual
      const messages: Content[] = relevantChatHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      logger.debug('Calling AgentService with messages:', messages);
      const response = await AgentService.processMessage(messages);
      logger.debug('AgentService response:', JSON.stringify(response, null, 2));
      
      // Process Gemini response and get UnifiedResponses
      const unifiedResponses = await this.processGeminiResponse(response, context);
      
      // Check if we need to do a multi-turn conversation
      const needsFollowUp = unifiedResponses.some(r => 
        r.metadata.shouldSend === false && 
        r.metadata.isRelevant === true &&
        r.content?.text
      );
      
      if (needsFollowUp) {
        // Build new message history including the tool responses
        const updatedMessages = [...messages];
        
        // Add the model's response (including function calls)
        if (response?.candidates?.[0]?.content) {
          updatedMessages.push(response.candidates[0].content);
        }
        
        // Add function responses as user messages (following Gemini's pattern)
        // The model expects function responses to come from 'user' role
        const functionResponses = unifiedResponses
          .filter(r => r.metadata.shouldSend === false && r.content?.text)
          .map(r => r.content!.text)
          .join('\n\n');
        
        if (functionResponses) {
          updatedMessages.push({
            role: 'user',
            parts: [{ text: functionResponses }]
          });
        }
        
        logger.debug('Making follow-up call to AgentService with tool responses');
        
        // Make a second call to the agent with the tool responses
        const followUpResponse = await AgentService.processMessage(updatedMessages);
        const followUpUnifiedResponses = await this.processGeminiResponse(followUpResponse, context);
        
        // Process the follow-up responses
        for (const followUpUnifiedResponse of followUpUnifiedResponses) {
          context.addUnifiedResponse(followUpUnifiedResponse);
          
          if (followUpUnifiedResponse.processedData) {
            await this.handlePreprocessedContent(context, followUpUnifiedResponse.processedData);
          }
        }
      } else {
        // Original flow: process responses normally
        for (const unifiedResponse of unifiedResponses) {
          // Add response to context
          context.addUnifiedResponse(unifiedResponse);
          
          // Handle special cases
          if (unifiedResponse.processedData) {
            await this.handlePreprocessedContent(context, unifiedResponse.processedData);
          }
        }
      }
    } catch (error) {
      logger.error("Error processing text message:", error);
      const errorResponse = ResponseBuilder.error(
        'PROCESSING_ERROR',
        "Error al procesar la solicitud: " + (error as Error).message
      );
      context.addUnifiedResponse(errorResponse);
    }
  }

  private static async handlePreprocessedContent(context: MessageContext, preprocessedContent: any): Promise<void> {
    try {
      // Handle warnings
      if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
        const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
        await sendWhatsAppMessage(context.message.from, warningMessage);
        
        // Add observations to context so they're saved in relevant history
        const warningResponse = ResponseBuilder.text(warningMessage, true);
        warningResponse.metadata.shouldSend = false; // Already sent with sendWhatsAppMessage
        context.addUnifiedResponse(warningResponse);
      }
      
      // Prepare order data
      const orderData: ProcessedOrderData = {
        orderItems: preprocessedContent.orderItems,
        orderType: preprocessedContent.orderType,
        scheduledAt: preprocessedContent.scheduledAt,
      };
      
      // Ahora createAndNotify devuelve el resultado y la respuesta
      const { workflowResult, responseToSend } = await PreOrderWorkflowService.createAndNotify({
        orderData,
        customerId: context.customer!.id,
        whatsappNumber: context.message.from,
      });
      
      // AÑADIR la respuesta devuelta al contexto del pipeline
      context.addUnifiedResponse(responseToSend);

      // Store the action token in context for potential tracking
      context.set(CONTEXT_KEYS.LAST_PREORDER_TOKEN, workflowResult.actionToken);
    } catch (error: any) {
      logger.error('Error creating preorder:', error);
      
      // For known business errors, use the direct message
      if (error instanceof BusinessLogicError || error instanceof ValidationError) {
        const businessErrorResponse = ResponseBuilder.error(
          error.code || 'BUSINESS_ERROR',
          error.message
        );
        context.addUnifiedResponse(businessErrorResponse);
        return;
      }
      
      // For other errors, use generic message
      const genericMessage = error instanceof TechnicalError 
        ? 'Lo siento, hubo un problema técnico. Por favor intenta de nuevo más tarde.'
        : 'Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.';
      
      const genericErrorResponse = ResponseBuilder.error(
        'GENERIC_ERROR',
        genericMessage
      );
      context.addUnifiedResponse(genericErrorResponse);
    }
  }

  /**
   * Process Gemini API response and extract meaningful content
   * This method is public so it can be used by tool handlers that need it
   */
  public static async processGeminiResponse(response: any, context?: MessageContext): Promise<UnifiedResponse[]> {
    logger.debug('=== processGeminiResponse DEBUG ===');
    logger.debug('Response type:', typeof response);
    logger.debug('Response keys:', response ? Object.keys(response) : 'null');
    
    const responses: UnifiedResponse[] = [];
    
    // Verify valid response structure
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Invalid response structure from Gemini API');
      
      const errorMessage = response?.error?.message || 
                          response?.candidates?.[0]?.finishReason || 
                          "Lo siento, hubo un problema al procesar tu solicitud. Por favor intenta de nuevo.";
      
      return [ResponseBuilder.error('GEMINI_ERROR', errorMessage)];
    }
    
    const parts = response.candidates[0].content.parts;
    
    // Process each part of the response
    for (const part of parts) {
      if (part.text) {
        // Simple text response
        responses.push(ResponseBuilder.text(part.text, true));
      } else if (part.functionCall) {
        // Process function calls
        const functionResponse = await this.handleFunctionCall(
          part.functionCall.name,
          part.functionCall.args,
          context
        );
        if (functionResponse) {
          // If function returns an array (multiple messages), add all
          if (Array.isArray(functionResponse)) {
            responses.push(...functionResponse);
          } else {
            responses.push(functionResponse);
          }
        }
      }
    }
    
    logger.debug(`Total responses processed: ${responses.length}`);
    logger.debug('=== End processGeminiResponse DEBUG ===');
    
    return responses;
  }

  private static async handleFunctionCall(name: string, args: any, context?: MessageContext): Promise<UnifiedResponse | UnifiedResponse[] | null> {
    logger.debug(`=== handleFunctionCall: ${name} ===`);
    
    // Get the handler for this function
    const handler = getToolHandler(name);
    
    if (handler) {
      try {
        const result = await handler(args, context);
        logger.debug(`Handler ${name} completed successfully`);
        return result;
      } catch (error) {
        logger.error(`Error in handler ${name}:`, error);
        
        // Special handling for ValidationError to pass structured error info to the agent
        if (error instanceof ValidationError) {
          // Convert ValidationError to a structured format the agent can understand
          const errorContextForAgent = {
            tool_name: name,
            error_code: error.code,
            error_message: error.message,
            context: error.context // This contains all the detailed error information
          };
          
          const errorAsText = `TOOL_EXECUTION_FAILED: ${JSON.stringify(errorContextForAgent)}`;
          
          // Return an internal marker that will be added to conversation history
          // but not sent to the user directly. The agent will see this and respond.
          return ResponseBuilder.internalMarker(errorAsText);
        }
        
        // For other types of errors, return a formatted error response
        return ResponseBuilder.error(
          'TOOL_ERROR',
          '😔 Lo siento, hubo un problema al procesar tu solicitud. Por favor, intenta de nuevo.'
        );
      }
    }
    
    logger.warn(`Unrecognized function call: ${name}`);
    return null;
  }
}