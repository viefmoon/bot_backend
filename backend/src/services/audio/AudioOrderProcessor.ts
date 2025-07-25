import { GeminiService } from '../ai/GeminiService';
import { MenuSearchService } from '../ai/MenuSearchService';
import { TechnicalError, ErrorCode } from '../../common/services/errors';
import { ConfigService } from '../config/ConfigService';
import { AudioOrderTools } from './AudioOrderTools';
import { AudioOrderPrompts } from './AudioOrderPrompts';
import logger from '../../common/utils/logger';

// Types
interface PizzaCustomization {
  customizationId: string;
  half: "FULL" | "HALF_1" | "HALF_2";
  action: "ADD" | "REMOVE";
}

interface AIOrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  modifiers?: string[];
  pizzaCustomizations?: PizzaCustomization[];
}

interface DeliveryInfoData {
  fullAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
}

interface ScheduledDeliveryData {
  time?: string; // HH:mm format
}

export interface AudioProcessingResult {
  orderItems?: AIOrderItem[];
  orderType?: "DELIVERY" | "TAKE_AWAY" | "DINE_IN";
  deliveryInfo?: DeliveryInfoData;
  scheduledDelivery?: ScheduledDeliveryData;
  warnings?: string;
}

interface ProcessWithGeminiParams {
  audioBase64: string;
  audioMimeType: string;
}

/**
 * Handles the AI processing logic for audio orders using Gemini
 */
export class AudioOrderProcessor {
  /**
   * Processes audio with Gemini AI using multi-turn conversation with tools
   */
  static async processWithGemini(params: ProcessWithGeminiParams): Promise<AudioProcessingResult> {
    const config = ConfigService.getConfig();
    const systemPrompt = AudioOrderPrompts.buildSystemPrompt(config.restaurantName);
    
    // Debug log the context being sent to Gemini
    logger.debug('Gemini request context', {
      audioMimeType: params.audioMimeType,
      audioSize: params.audioBase64.length
    });

    const userPrompt = AudioOrderPrompts.buildUserPrompt();

    const contents = [{
      role: "user" as const,
      parts: [
        { text: userPrompt },
        { 
          inlineData: { 
            mimeType: params.audioMimeType, 
            data: params.audioBase64 
          } 
        }
      ]
    }];

    const tools = AudioOrderTools.getAllTools();

    const response = await GeminiService.generateContentWithHistory(
      contents,
      systemPrompt,
      tools,
      {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: AudioOrderTools.getAllowedFunctionNames()
        }
      }
    );

    // Handle multi-turn conversation for tool calls
    const result = await this.handleToolCalls(response, contents, systemPrompt, tools);
    
    // Debug log the extracted data
    logger.debug('Gemini extracted data', {
      functionCallArgs: result,
      hasOrderItems: !!result.orderItems?.length,
      orderType: result.orderType,
      hasDeliveryInfo: !!result.deliveryInfo,
      hasScheduledDelivery: !!result.scheduledDelivery
    });

    return result;
  }

  /**
   * Handles multi-turn conversation with tool calls
   */
  private static async handleToolCalls(
    response: any,
    contents: any[],
    systemPrompt: string,
    tools: any[]
  ): Promise<AudioProcessingResult> {
    let currentContents = [...contents];
    let currentResponse = response;

    while (true) {
      const functionCall = currentResponse.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      
      if (!functionCall) {
        throw new TechnicalError(
          ErrorCode.AI_PROCESSING_ERROR,
          'No se pudo procesar el audio - no hay función llamada'
        );
      }

      logger.debug('Tool call detected', {
        functionName: functionCall.name,
        args: functionCall.args
      });

      if (functionCall.name === 'get_menu_information') {
        // Handle menu search tool
        const query = functionCall.args.query;
        const relevantMenuJSON = await MenuSearchService.getRelevantMenu(query);
        const toolResult = AudioOrderPrompts.buildMenuToolResult(query, relevantMenuJSON);

        // Add tool call and result to conversation
        currentContents.push({
          role: "model" as const,
          parts: [{ functionCall }]
        });
        currentContents.push({
          role: "function" as const,
          parts: [{
            functionResponse: {
              name: 'get_menu_information',
              response: { result: toolResult }
            }
          }]
        });

        // Continue conversation
        currentResponse = await GeminiService.generateContentWithHistory(
          currentContents,
          systemPrompt,
          tools,
          {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: AudioOrderTools.getAllowedFunctionNames()
            }
          }
        );

      } else if (functionCall.name === 'extract_order_data') {
        // Final extraction - return the result
        return functionCall.args as AudioProcessingResult;
        
      } else {
        throw new TechnicalError(
          ErrorCode.AI_PROCESSING_ERROR,
          `Función no reconocida: ${functionCall.name}`
        );
      }
    }
  }
}