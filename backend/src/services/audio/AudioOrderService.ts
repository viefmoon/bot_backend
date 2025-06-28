import { MenuSearchService } from '../ai/MenuSearchService';
import { GeminiService } from '../ai/GeminiService';
import { BusinessLogicError, ErrorCode, TechnicalError } from '../../common/services/errors';
import logger from '../../common/utils/logger';
import { ConfigService } from '../config/ConfigService';

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

interface AudioProcessingResult {
  orderItems?: AIOrderItem[];
  orderType?: "DELIVERY" | "TAKE_AWAY" | "DINE_IN";
  deliveryInfo?: DeliveryInfoData;
  scheduledDelivery?: ScheduledDeliveryData;
  warnings?: string;
}

interface ProcessAudioParams {
  audioBuffer: Buffer;
  audioMimeType: string;
  transcription: string;
}

interface ProcessWithGeminiParams {
  audioBase64: string;
  audioMimeType: string;
  transcription: string;
  relevantMenu: string;
}

export class AudioOrderService {
  private static readonly MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

  static async processAudioOrder(params: ProcessAudioParams): Promise<AudioProcessingResult> {
    try {
      logger.info('Starting audio order processing', {
        audioSize: params.audioBuffer.length,
        mimeType: params.audioMimeType
      });

      // Validate audio size
      if (params.audioBuffer.length > this.MAX_AUDIO_SIZE) {
        throw new BusinessLogicError(
          ErrorCode.FILE_TOO_LARGE,
          'El archivo de audio es demasiado grande. Máximo 10MB permitido.'
        );
      }

      // Process in parallel for better performance
      const [relevantMenuJson, audioBase64] = await Promise.all([
        MenuSearchService.getRelevantMenu(params.transcription),
        Promise.resolve(this.prepareAudioBase64(params.audioBuffer))
      ]);

      const searchResults = JSON.parse(relevantMenuJson);
      // Use empty array if no products found - we can still extract delivery info
      const relevantMenu = searchResults?.length > 0 ? relevantMenuJson : '[]';
      
      // Debug logging
      logger.debug('Audio processing debug info', {
        transcription: params.transcription,
        transcriptionLength: params.transcription.length,
        relevantMenuProductCount: searchResults?.length || 0,
        relevantMenu: relevantMenu
      });

      const extractedData = await this.processWithGemini({
        audioBase64,
        audioMimeType: params.audioMimeType,
        transcription: params.transcription,
        relevantMenu
      });

      logger.info('Audio order processing completed', {
        hasOrderItems: !!extractedData.orderItems?.length,
        orderType: extractedData.orderType,
        hasDeliveryInfo: !!extractedData.deliveryInfo,
        hasScheduledDelivery: !!extractedData.scheduledDelivery
      });

      return extractedData;
    } catch (error) {
      logger.error('Error processing audio order', { error });
      throw error;
    }
  }

  private static prepareAudioBase64(audioBuffer: Buffer): string {
    return audioBuffer.toString('base64');
  }

  private static async processWithGemini(params: ProcessWithGeminiParams): Promise<AudioProcessingResult> {
    const config = ConfigService.getConfig();
    const systemPrompt = this.buildAudioOrderPrompt(config.restaurantName);
    
    const orderContext = {
      transcription: params.transcription,
      relevantMenu: params.relevantMenu
    };

    // Debug log the context being sent to Gemini
    logger.debug('Gemini request context', {
      transcriptionPreview: params.transcription.substring(0, 100) + '...',
      relevantMenuPreview: params.relevantMenu.substring(0, 200) + '...',
      fullContextSize: JSON.stringify(orderContext).length
    });

    const userPrompt = `Analiza el audio del pedido. La transcripción puede tener errores, prioriza el audio.

Contexto:
${JSON.stringify(orderContext, null, 2)}

Solo extrae información mencionada EXPLÍCITAMENTE. No inventes datos.`;

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

    const toolDefinition = this.buildExtractOrderDataTool();

    const response = await GeminiService.generateContentWithHistory(
      contents,
      systemPrompt,
      [toolDefinition],
      {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['extract_order_data']
        }
      }
    );

    const functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    
    if (!functionCall || functionCall.name !== 'extract_order_data') {
      logger.error('Gemini response error - no function call', {
        response: JSON.stringify(response, null, 2)
      });
      throw new TechnicalError(
        ErrorCode.AI_PROCESSING_ERROR,
        'No se pudo procesar el audio'
      );
    }

    // Debug log the extracted data
    logger.debug('Gemini extracted data', {
      functionCallArgs: functionCall.args,
      hasOrderItems: !!(functionCall.args as any).orderItems?.length,
      orderType: (functionCall.args as any).orderType,
      hasDeliveryInfo: !!(functionCall.args as any).deliveryInfo,
      hasScheduledDelivery: !!(functionCall.args as any).scheduledDelivery
    });

    return functionCall.args as AudioProcessingResult;
  }

  private static buildExtractOrderDataTool() {
    return {
      name: 'extract_order_data',
      description: 'Extrae información del audio del pedido',
      parameters: {
        type: 'object',
        properties: {
          orderType: {
            type: 'string',
            enum: ['DELIVERY', 'TAKE_AWAY', 'DINE_IN'],
            description: 'Tipo de orden inferido del contexto'
          },
          orderItems: {
            type: 'array',
            description: 'Productos del menú mencionados',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string' },
                quantity: { type: 'number' },
                modifiers: {
                  type: 'array',
                  items: { type: 'string' }
                },
                pizzaCustomizations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      customizationId: { type: 'string' },
                      half: { type: 'string', enum: ['FULL', 'HALF_1', 'HALF_2'] },
                      action: { type: 'string', enum: ['ADD', 'REMOVE'] }
                    },
                    required: ['customizationId', 'half', 'action']
                  }
                }
              },
              required: ['productId', 'quantity']
            }
          },
          deliveryInfo: {
            type: 'object',
            description: 'Información de entrega',
            properties: {
              fullAddress: { type: 'string' },
              recipientName: { type: 'string' },
              recipientPhone: { type: 'string' }
            }
          },
          scheduledDelivery: {
            type: 'object',
            description: 'Hora de entrega programada',
            properties: {
              time: { type: 'string', description: 'Formato HH:mm' }
            }
          },
          warnings: {
            type: 'string',
            description: 'Productos no identificados o información confusa'
          }
        }
      }
    };
  }

  private static buildAudioOrderPrompt(restaurantName: string): string {
    return `Eres un asistente de ${restaurantName} especializado en procesar pedidos de audio.

REGLAS:
1. Extrae SOLO información mencionada explícitamente en el audio
2. NO inventes datos que no se mencionen
3. Usa solo productos de relevantMenu
4. Si hasVariants: true, especifica variantId
5. Convierte horarios a formato 24h (ej: "3pm" → "15:00")
6. NO extraigas fechas, solo horas

TIPO DE ORDEN (orderType):
- DELIVERY: Si mencionan dirección de entrega o domicilio
- TAKE_AWAY: Si mencionan recoger, pasar por, o nombre para recolección sin dirección
- DINE_IN: Si no mencionan ni dirección ni recolección (por defecto)

EJEMPLOS:
- "Pizza hawaiana grande" → orderType: "DINE_IN", orderItems con producto
- "Entregar en Juárez 123" → orderType: "DELIVERY", deliveryInfo.fullAddress
- "Para recoger a nombre de Juan" → orderType: "TAKE_AWAY", deliveryInfo.recipientName
- "Mi teléfono 555-1234" → deliveryInfo.recipientPhone
- "A las 3 de la tarde" → scheduledDelivery.time: "15:00"`;
  }
}