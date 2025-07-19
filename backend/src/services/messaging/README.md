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

#### Middlewares Actuales (en orden de ejecución):
1. **RateLimitMiddleware**: Controla el límite de mensajes por usuario
2. **CustomerValidationMiddleware**: Valida y carga información del cliente, crea clientes nuevos si no existen
3. **RestaurantHoursMiddleware**: Verifica si el restaurante está abierto antes de procesar
4. **AddressRequiredMiddleware**: Bloquea toda interacción si el cliente no tiene dirección registrada
5. **MessageTypeMiddleware**: Detecta el tipo de mensaje (texto, audio, interactivo) y maneja mensajes de bienvenida
6. **MessageProcessingMiddleware**: Aplica la estrategia de procesamiento según el tipo de mensaje

## Uso

### Flujo de Procesamiento

1. **Webhook de WhatsApp** → `WhatsAppService.handleWebhook()`
2. **Enqueue a BullMQ** → Respuesta inmediata 200 OK al webhook
3. **BullMQ Worker** → Proceso separado que consume mensajes de la cola
4. **MessageProcessor** → Convierte el mensaje al formato del pipeline
5. **Pipeline** ejecuta los middlewares en orden:
   - Crea un `MessageContext`
   - Ejecuta cada middleware secuencialmente
   - Cada middleware puede detener el flujo si es necesario
   - Procesa el mensaje según su tipo
   - Envía respuestas (texto, interactivas, botones con URL)
   - Actualiza el historial del chat (completo y relevante)

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
- **TextMessageStrategy**: Procesa mensajes de texto con AI (Agente General y Agente de Órdenes)
- **InteractiveMessageStrategy**: Maneja botones y listas interactivas (respuestas directas sin AI)
- **AudioMessageStrategy**: Transcribe audio a texto usando Gemini, luego procesa como texto

### Lógica de Negocio Crítica

1. **Requisito de Dirección**: Los clientes DEBEN tener una dirección registrada antes de cualquier conversación
   - Aplicado por `AddressRequiredMiddleware`
   - Genera OTP y envía enlace de registro
   - Bloquea todas las demás interacciones hasta completarse

2. **Horarios del Restaurante**: Si el restaurante está cerrado, se bloquea el procesamiento
   - Aplicado por `RestaurantHoursMiddleware`
   - Envía mensaje con horarios disponibles

3. **Límite de Tasa**: Control de mensajes por usuario para prevenir spam
   - Configurado en `RateLimitMiddleware`
   - Usa Redis o memoria según disponibilidad

### Extensibilidad
Para agregar soporte a nuevos tipos de mensajes, simplemente crea una nueva estrategia que extienda `MessageStrategy`.

## Ventajas del Sistema

1. **Modularidad**: Cada responsabilidad en su propio middleware
2. **Testabilidad**: Fácil testear cada componente por separado
3. **Mantenibilidad**: Código más limpio y organizado
4. **Extensibilidad**: Fácil agregar nuevas funcionalidades
5. **Escalabilidad**: Diseñado para crecer con nuevos requerimientos
6. **Procesamiento Asíncrono**: Uso de BullMQ previene timeouts de WhatsApp
7. **Procesamiento Secuencial**: Bloqueo distribuido garantiza orden de mensajes por usuario

## Debugging

El pipeline incluye logs detallados:
```
DEBUG: Running middleware: RateLimitMiddleware
DEBUG: Running middleware: CustomerValidationMiddleware
DEBUG: Running middleware: RestaurantHoursMiddleware
DEBUG: Running middleware: AddressRequiredMiddleware
DEBUG: Pipeline stopped by middleware: AddressRequiredMiddleware
```

Esto facilita identificar dónde ocurren problemas.

## Gestión del Historial de Chat

- **Historial Completo**: Se guarda todo para contexto completo
- **Historial Relevante**: Últimos 20 mensajes para procesamiento AI
- **Limpieza Automática**: Eliminación de mensajes duplicados consecutivos
- **Marcadores de Historial**: Eventos importantes (resets, órdenes confirmadas)

## Configuración y Cache

- `ConfigService`: Carga y cachea configuración del restaurante con auto-recarga
- TTL del Cache: 2 minutos (se recarga automáticamente cuando expira)
- Todos los mensajes predefinidos aceptan configuración como parámetro