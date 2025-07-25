/**
 * Prompt templates for audio order processing
 */
export class AudioOrderPrompts {
  /**
   * Builds the system prompt for audio order processing
   */
  static buildSystemPrompt(restaurantName: string): string {
    return `Eres un asistente de ${restaurantName} especializado en procesar pedidos de audio.

REGLAS:
1. Extrae SOLO información mencionada explícitamente en el audio
2. NO inventes datos que no se mencionen
3. Usa solo productos de relevantMenu
4. Si hasVariants: true, especifica variantId
5. Convierte horarios a formato 24h (ej: "3pm" → "15:00")
6. NO extraigas fechas, solo horas

TIPO DE ORDEN (orderType) - OPCIONAL:
- DELIVERY: SOLO si mencionan explícitamente dirección de entrega o domicilio
- TAKE_AWAY: SOLO si mencionan explícitamente recoger, pasar por, o recolección
- DINE_IN: SOLO si mencionan explícitamente comer en el lugar, mesa, etc.
- NO especificar orderType si no se menciona claramente el tipo de servicio

EJEMPLOS:
- "Pizza hawaiana grande" → NO incluir orderType (no se menciona tipo)
- "Entregar en Juárez 123" → orderType: "DELIVERY", deliveryInfo.fullAddress
- "Para recoger a nombre de Juan" → orderType: "TAKE_AWAY", deliveryInfo.recipientName
- "Comer aquí en mesa" → orderType: "DINE_IN"
- "Mi teléfono 555-1234" → deliveryInfo.recipientPhone (sin orderType)
- "A las 3 de la tarde" → scheduledDelivery.time: "15:00" (sin orderType)`;
  }

  /**
   * Builds the user prompt for audio processing with instructions
   */
  static buildUserPrompt(): string {
    return `Analiza este audio de pedido de restaurante.

INSTRUCCIONES:
1. Usa el tool get_menu_information para buscar productos que escuches en el audio
2. Luego extrae la información del pedido con extract_order_data usando los productos encontrados
3. Solo extrae información mencionada EXPLÍCITAMENTE en el audio. No inventes datos.`;
  }

  /**
   * Builds the tool result message for menu information
   */
  static buildMenuToolResult(query: string, menuJSON: string): string {
    return `Productos encontrados para "${query}": ${menuJSON}`;
  }
}