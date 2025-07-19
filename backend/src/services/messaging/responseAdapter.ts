import { MessageResponse, UnifiedResponse, ResponseBuilder, ResponseType } from './types';

/**
 * Adaptador para convertir MessageResponse (antiguo) a UnifiedResponse (nuevo)
 * Este adaptador es temporal durante la migración y será eliminado cuando
 * todos los componentes usen UnifiedResponse directamente.
 */
export function adaptMessageResponseToUnified(response: MessageResponse): UnifiedResponse {
  // Si hay mensaje interactivo, usar el builder de interactive
  if (response.interactiveMessage) {
    // Los mensajes interactivos de confirmación de pedido son relevantes
    const isRelevant = response.isRelevant || false;
    return ResponseBuilder.interactive(response.interactiveMessage, response.preOrderId, isRelevant);
  }
  
  // Si hay historyMarker, usar textWithHistoryMarker
  if (response.historyMarker && response.text) {
    // El historyMarker tiene prioridad para el historial
    return ResponseBuilder.textWithHistoryMarker(response.text, response.historyMarker);
  }
  
  // Si es un mensaje de confirmación adicional
  if (response.confirmationMessage) {
    // Los mensajes de confirmación son siempre relevantes
    return ResponseBuilder.text(response.confirmationMessage, true);
  }
  
  // Caso general: mensaje de texto
  if (response.text) {
    const unifiedResponse = ResponseBuilder.text(response.text, response.isRelevant);
    
    // Ajustar shouldSend según el valor original
    unifiedResponse.metadata.shouldSend = response.sendToWhatsApp;
    
    // Si hay preOrderId, agregarlo
    if (response.preOrderId) {
      unifiedResponse.metadata.preOrderId = response.preOrderId;
    }
    
    return unifiedResponse;
  }
  
  // Si no hay contenido, devolver respuesta vacía
  return ResponseBuilder.empty();
}

/**
 * Convierte un array de MessageResponse a UnifiedResponse
 */
export function adaptMessageResponsesToUnified(responses: MessageResponse[]): UnifiedResponse[] {
  return responses.map(adaptMessageResponseToUnified);
}