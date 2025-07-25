/**
 * Tool definitions for audio order processing with Gemini AI
 */
export class AudioOrderTools {
  /**
   * Tool for searching relevant menu items from audio transcription
   */
  static buildGetMenuInformationTool() {
    return {
      name: 'get_menu_information',
      description: 'Busca productos del menú mencionados en el audio. Úsalo PRIMERO para identificar qué productos se mencionan antes de crear el pedido.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Términos de productos extraídos del audio transcrito (ej: "pizza hawaiana grande, coca cola")'
          }
        },
        required: ['query']
      }
    };
  }

  /**
   * Tool for extracting structured order data from audio
   */
  static buildExtractOrderDataTool() {
    return {
      name: 'extract_order_data',
      description: 'Extrae información del audio del pedido',
      parameters: {
        type: 'object',
        properties: {
          orderType: {
            type: 'string',
            enum: ['DELIVERY', 'TAKE_AWAY', 'DINE_IN'],
            description: 'Tipo de orden SOLO si se menciona explícitamente en el audio. No incluir si no está claro.'
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

  /**
   * Get all available tools for audio processing
   */
  static getAllTools() {
    return [
      this.buildGetMenuInformationTool(),
      this.buildExtractOrderDataTool()
    ];
  }

  /**
   * Get allowed function names for Gemini function calling
   */
  static getAllowedFunctionNames(): string[] {
    return ['get_menu_information', 'extract_order_data'];
  }
}