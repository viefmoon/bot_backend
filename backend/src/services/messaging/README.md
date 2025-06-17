# Pipeline de Procesamiento de Mensajes

Este sistema de pipeline permite un procesamiento de mensajes modular y mantenible para el bot de WhatsApp.

## Arquitectura

### Pipeline Principal
- `MessagePipeline`: Orquesta el flujo de procesamiento de mensajes
- `MessageContext`: Contiene toda la información del mensaje y su procesamiento
- `MessageProcessor`: Interfaz principal para procesar mensajes de WhatsApp

### Middlewares
Los middlewares se ejecutan en orden y cada uno puede:
- Modificar el contexto
- Detener el procesamiento (`context.stop()`)
- Agregar respuestas
- Manejar errores

#### Middlewares Actuales:
1. **RateLimitMiddleware**: Controla el límite de mensajes por usuario
2. **CustomerValidationMiddleware**: Valida y carga información del cliente
3. **MessageTypeMiddleware**: Maneja diferentes tipos de mensajes y mensajes de bienvenida

## Uso

### Flujo de Procesamiento

1. **Webhook de WhatsApp** → `messageProcessor.ts`
2. **MessageProcessor** convierte el mensaje al formato del pipeline
3. **Pipeline** ejecuta los middlewares en orden:
   - Crea un `MessageContext`
   - Ejecuta cada middleware
   - Procesa el mensaje según su tipo
   - Envía respuestas
   - Actualiza el historial del chat

### Agregar Nuevos Middlewares

```typescript
// Crear el middleware
export class MyMiddleware implements MessageMiddleware {
  name = 'MyMiddleware';
  
  async process(context: MessageContext): Promise<MessageContext> {
    // Tu lógica aquí
    return context;
  }
}

// Agregarlo al pipeline
pipeline.addMiddleware(new MyMiddleware());
```

## Estructura de Estrategias

### Estrategias de Procesamiento
- **TextMessageStrategy**: Procesa mensajes de texto con AI
- **InteractiveMessageStrategy**: Maneja botones y listas interactivas
- **AudioMessageStrategy**: Transcribe audio a texto usando Gemini

### Extensibilidad
Para agregar soporte a nuevos tipos de mensajes, simplemente crea una nueva estrategia que extienda `MessageStrategy`.

## Ventajas del Sistema

1. **Modularidad**: Cada responsabilidad en su propio middleware
2. **Testabilidad**: Fácil testear cada componente por separado
3. **Mantenibilidad**: Código más limpio y organizado
4. **Extensibilidad**: Fácil agregar nuevas funcionalidades
5. **Escalabilidad**: Diseñado para crecer con nuevos requerimientos

## Debugging

El pipeline incluye logs detallados:
```
DEBUG: Running middleware: RateLimitMiddleware
DEBUG: Running middleware: CustomerValidationMiddleware
DEBUG: Pipeline stopped by middleware: RateLimitMiddleware
```

Esto facilita identificar dónde ocurren problemas.