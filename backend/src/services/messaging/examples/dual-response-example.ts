/**
 * Ejemplo de cómo el sistema puede manejar tanto MessageResponse (antiguo)
 * como UnifiedResponse (nuevo) durante la migración
 */

import { MessageContext } from '../MessageContext';
import { ResponseBuilder } from '../types';

// Ejemplo de un middleware/estrategia que todavía usa el sistema antiguo
function oldStyleHandler(context: MessageContext) {
  // Sistema antiguo - usando addResponse
  context.addResponse({
    text: "Este es un mensaje del sistema antiguo",
    sendToWhatsApp: true,
    isRelevant: true,
    historyMarker: "MENSAJE ANTIGUO ENVIADO"
  });
  
  // Mensaje interactivo antiguo
  context.addResponse({
    interactiveMessage: {
      type: "button",
      body: { text: "Seleccione una opción" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "btn1", title: "Opción 1" } }
        ]
      }
    },
    sendToWhatsApp: true,
    isRelevant: false
  });
}

// Ejemplo de un handler nuevo que usa UnifiedResponse
function newStyleHandler(context: MessageContext) {
  // Sistema nuevo - usando addUnifiedResponse
  context.addUnifiedResponse(
    ResponseBuilder.text("Este es un mensaje del sistema nuevo", true)
  );
  
  // Mensaje con marcador de historial diferente
  context.addUnifiedResponse(
    ResponseBuilder.textWithHistoryMarker(
      "Mensaje largo para el usuario con muchos detalles...",
      "RESUMEN: Mensaje enviado"
    )
  );
  
  // Mensaje interactivo nuevo con relevancia configurada
  const interactiveMsg = {
    type: "button",
    body: { text: "¿Confirmar pedido?" },
    action: {
      buttons: [
        { type: "reply", reply: { id: "confirm", title: "Confirmar" } },
        { type: "reply", reply: { id: "cancel", title: "Cancelar" } }
      ]
    }
  };
  
  context.addUnifiedResponse(
    ResponseBuilder.interactive(interactiveMsg, 123, true) // isRelevant = true para confirmaciones
  );
}

// Ejemplo de uso en un pipeline
export function demonstrateDualSystem() {
  // Crear contexto de mensaje simulado
  const context = new MessageContext({
    id: "msg123",
    from: "521234567890",
    type: "text",
    timestamp: "1234567890",
    text: { body: "Hola" }
  });
  
  // Ambos tipos de handlers pueden coexistir
  oldStyleHandler(context);
  newStyleHandler(context);
  
  // El MessagePipeline procesará ambos tipos correctamente:
  // - context.responses será adaptado a UnifiedResponse
  // - context.unifiedResponses se usará directamente
  // - Todos se enviarán y guardarán en el historial correctamente
  
  console.log("Respuestas antiguas:", context.responses.length);
  console.log("Respuestas nuevas:", context.unifiedResponses.length);
}