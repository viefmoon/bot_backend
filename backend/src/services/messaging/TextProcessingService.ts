import { MessageContext } from './MessageContext';
import { AgentService } from '../ai';
import { PreOrderWorkflowService } from '../orders/PreOrderWorkflowService';
import { sendWhatsAppMessage } from '../whatsapp';
import { getToolHandler } from '../ai/tools/toolHandlers';
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

    let relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Create a working copy that includes the current message
    const workingHistory = [...relevantChatHistory];
    workingHistory.push({ role: "user", content: text });
    
    try {
      // Process with AI - use workingHistory that includes the current message
      const messages: Content[] = workingHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      logger.debug('Calling AgentService.processMessage with messages:', messages);
      const response = await AgentService.processMessage(messages);
      logger.debug('AgentService response:', JSON.stringify(response, null, 2));
      
      // Convert response to expected format
      const aiResponses = await this.processGeminiResponse(response, context);
      
      // Process AI responses
      for (const response of aiResponses) {
        if (response.text) {
          context.addResponse({
            text: response.text,
            sendToWhatsApp: response.sendToWhatsApp !== false,
            isRelevant: response.isRelevant !== false,
            historyMarker: response.historyMarker
          });
        }
        
        if (response.urlButton) {
          // Handle URL button message
          const { sendMessageWithUrlButton } = await import('../whatsapp');
          await sendMessageWithUrlButton(
            context.message.from,
            response.urlButton.title,
            response.urlButton.body,
            response.urlButton.buttonText,
            response.urlButton.url
          );
          
          // Add to context so it's saved in history
          context.addResponse({
            text: `${response.urlButton.title}\n\n${response.urlButton.body}`,
            sendToWhatsApp: false, // Already sent with sendMessageWithUrlButton
            isRelevant: response.isRelevant !== false
          });
        }
        
        if (response.preprocessedContent) {
          await this.handlePreprocessedContent(context, response.preprocessedContent);
        }
        
        if (response.confirmationMessage) {
          context.addResponse({
            text: response.confirmationMessage,
            sendToWhatsApp: true,
            isRelevant: true
          });
        }
      }
    } catch (error) {
      logger.error("Error processing text message:", error);
      context.addResponse({
        text: "Error al procesar la solicitud: " + (error as Error).message,
        sendToWhatsApp: true,
        isRelevant: true
      });
    }
  }

  private static async handlePreprocessedContent(context: MessageContext, preprocessedContent: any): Promise<void> {
    try {
      // Handle warnings
      if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
        const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
        await sendWhatsAppMessage(context.message.from, warningMessage);
        
        // Add observations to context so they're saved in relevant history
        context.addResponse({
          text: warningMessage,
          sendToWhatsApp: false, // Already sent with sendWhatsAppMessage
          isRelevant: true
        });
      }
      
      // Prepare order data
      const orderData: ProcessedOrderData = {
        orderItems: preprocessedContent.orderItems,
        orderType: preprocessedContent.orderType,
        scheduledAt: preprocessedContent.scheduledAt,
      };
      
      // Use the PreOrderWorkflowService
      const workflowResult = await PreOrderWorkflowService.createAndNotify({
        orderData,
        customerId: context.customer!.id,
        whatsappNumber: context.message.from,
      });
      
      // Store the action token in context for potential tracking
      context.set('lastPreOrderToken', workflowResult.actionToken);
      
      // Mark that interactive response was already sent by the workflow
      context.set('interactiveResponseSent', true);
    } catch (error: any) {
      logger.error('Error creating preorder:', error);
      
      // For known business errors, use the direct message
      if (error instanceof BusinessLogicError || error instanceof ValidationError) {
        context.addResponse({
          text: error.message,
          isRelevant: true,
          sendToWhatsApp: true
        });
        return;
      }
      
      // For other errors, use generic message
      const genericMessage = error instanceof TechnicalError 
        ? 'Lo siento, hubo un problema técnico. Por favor intenta de nuevo más tarde.'
        : 'Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.';
      
      context.addResponse({
        text: genericMessage,
        isRelevant: true,
        sendToWhatsApp: true
      });
    }
  }

  /**
   * Process Gemini API response and extract meaningful content
   * This method is public so it can be used by tool handlers that need it
   */
  public static async processGeminiResponse(response: any, context?: MessageContext): Promise<any[]> {
    logger.debug('=== processGeminiResponse DEBUG ===');
    logger.debug('Response type:', typeof response);
    logger.debug('Response keys:', response ? Object.keys(response) : 'null');
    
    const responses: any[] = [];
    
    // Verify valid response structure
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Invalid response structure from Gemini API');
      
      const errorMessage = response?.error?.message || 
                          response?.candidates?.[0]?.finishReason || 
                          "Lo siento, hubo un problema al procesar tu solicitud. Por favor intenta de nuevo.";
      
      return [{
        text: errorMessage,
        isRelevant: true
      }];
    }
    
    const parts = response.candidates[0].content.parts;
    
    // Process each part of the response
    for (const part of parts) {
      if (part.text) {
        // Simple text response
        responses.push({
          text: part.text,
          isRelevant: true,
        });
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

  private static async handleFunctionCall(name: string, args: any, context?: MessageContext): Promise<any | null> {
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
        throw error;
      }
    }
    
    logger.warn(`Unrecognized function call: ${name}`);
    return null;
  }
}