# Guía Completa de Integración - Endpoint de Procesamiento de Audio

## Tabla de Contenidos
1. [Información General](#información-general)
2. [Configuración del Endpoint](#configuración-del-endpoint)
3. [Autenticación](#autenticación)
4. [Formato de Entrada](#formato-de-entrada)
5. [Formato de Respuesta](#formato-de-respuesta)
6. [Ejemplos de Implementación](#ejemplos-de-implementación)
7. [Manejo de Errores](#manejo-de-errores)
8. [Casos de Uso y Escenarios](#casos-de-uso-y-escenarios)
9. [Optimizaciones y Mejores Prácticas](#optimizaciones-y-mejores-prácticas)
10. [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)

## Información General

### Propósito
Este endpoint procesa archivos de audio conteniendo pedidos de restaurante, extrayendo automáticamente:
- Productos del menú con cantidades, variantes y modificadores
- Información de entrega (dirección, destinatario, teléfono)
- Horario de entrega programada

### Características Clave
- **Procesamiento Multimodal**: Analiza tanto el audio como la transcripción para mayor precisión
- **Extracción Inteligente**: Solo captura información mencionada explícitamente
- **Búsqueda Semántica**: Identifica productos del menú usando embeddings y pgvector
- **Respuesta Estructurada**: Garantiza formato JSON consistente usando function calling

## Configuración del Endpoint

### URL Base
```
https://tu-dominio.com/api/v1/audio/process-order
```

### Método HTTP
```
POST
```

### Headers Requeridos
```http
Content-Type: multipart/form-data
X-API-Key: {CLOUD_API_KEY}
```

### Tamaño Máximo
- **Audio**: 10MB máximo
- **Formatos Soportados**: mp4, mpeg, ogg, wav, webm

## Autenticación

### Configuración de API Key
La autenticación se realiza mediante el header `X-API-Key`:

```javascript
// Ejemplo en JavaScript
const headers = {
  'X-API-Key': process.env.CLOUD_API_KEY
};
```

### Obtención de API Key
1. Solicita tu `CLOUD_API_KEY` al administrador del sistema
2. Almacénala de forma segura (variables de entorno)
3. Nunca la expongas en código cliente o logs

## Formato de Entrada

### Estructura del Request

El endpoint espera datos en formato `multipart/form-data` con los siguientes campos:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `audio` | File | Sí | Archivo de audio con el pedido |
| `transcription` | String | Sí | Transcripción del audio (de Google Speech-to-Text o similar) |

### Ejemplo de Request Body
```javascript
const formData = new FormData();
formData.append('audio', audioFile); // File object o Blob
formData.append('transcription', 'Quiero dos pizzas grandes hawaianas para entregar en Calle Juárez 123');
```

### Formatos de Audio Soportados
```javascript
const SUPPORTED_AUDIO_FORMATS = [
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm'
];
```

## Formato de Respuesta

### Estructura de Respuesta Exitosa (200 OK)

```typescript
interface SuccessResponse {
  success: true;
  data: {
    orderItems?: AIOrderItem[];
    orderType?: "DELIVERY" | "TAKE_AWAY" | "DINE_IN";
    deliveryInfo?: DeliveryInfoData;
    scheduledDelivery?: ScheduledDeliveryData;
    warnings?: string;
  };
}
```

### Tipos de Datos Detallados

#### OrderType
```typescript
type OrderType = "DELIVERY" | "TAKE_AWAY" | "DINE_IN";
```
- **DELIVERY**: Se infiere cuando mencionan dirección de entrega o domicilio
- **TAKE_AWAY**: Se infiere cuando mencionan recoger o nombre para recolección sin dirección
- **DINE_IN**: Valor por defecto cuando no se menciona ni entrega ni recolección

#### AIOrderItem
```typescript
interface AIOrderItem {
  productId: string;              // ID único del producto
  variantId?: string;             // ID de la variante (tamaño, tipo)
  quantity: number;               // Cantidad solicitada
  modifiers?: string[];           // IDs de modificadores (sin cebolla, extra queso)
  pizzaCustomizations?: Array<{   // Solo para pizzas
    customizationId: string;      // ID del ingrediente o sabor
    half: "FULL" | "HALF_1" | "HALF_2";  // Porción de la pizza
    action: "ADD" | "REMOVE";     // Agregar o quitar
  }>;
}
```

#### DeliveryInfoData
```typescript
interface DeliveryInfoData {
  fullAddress?: string;      // Dirección completa de entrega
  recipientName?: string;    // Nombre del destinatario
  recipientPhone?: string;   // Teléfono de contacto
}
```

#### ScheduledDeliveryData
```typescript
interface ScheduledDeliveryData {
  time?: string;  // Hora en formato HH:mm (24 horas)
}
```

### Ejemplo de Respuesta Completa
```json
{
  "success": true,
  "data": {
    "orderItems": [
      {
        "productId": "PZ",
        "variantId": "PZ-V-2",
        "quantity": 2,
        "modifiers": [],
        "pizzaCustomizations": [
          {
            "customizationId": "PIZZA-HAWAIANA",
            "half": "FULL",
            "action": "ADD"
          }
        ]
      }
    ],
    "orderType": "DELIVERY",
    "deliveryInfo": {
      "fullAddress": "Calle Juárez 123, Colonia Centro",
      "recipientName": "Juan Pérez",
      "recipientPhone": "555-1234567"
    },
    "scheduledDelivery": {
      "time": "14:30"
    },
    "warnings": null
  }
}
```

## Ejemplos de Implementación

### React Native / Expo

```typescript
import * as FileSystem from 'expo-file-system';
import * as Audio from 'expo-av';

interface AudioOrderResponse {
  success: boolean;
  data?: {
    orderItems?: any[];
    deliveryInfo?: any;
    scheduledDelivery?: any;
    warnings?: string;
    processingTime: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

class AudioOrderService {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async processAudioOrder(
    audioUri: string, 
    transcription: string
  ): Promise<AudioOrderResponse> {
    try {
      // Crear FormData
      const formData = new FormData();
      
      // Agregar archivo de audio
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/mp4',
        name: 'order.mp4'
      } as any);
      
      // Agregar transcripción
      formData.append('transcription', transcription);

      // Realizar petición
      const response = await fetch(`${this.apiUrl}/api/v1/audio/process-order`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          // NO incluir Content-Type, fetch lo agregará automáticamente
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error procesando audio');
      }

      return data;
    } catch (error) {
      console.error('Error processing audio order:', error);
      throw error;
    }
  }
}

// Uso
const audioService = new AudioOrderService(
  'https://api.turestaurante.com',
  'tu-cloud-api-key'
);

// Procesar orden
const result = await audioService.processAudioOrder(
  audioFileUri,
  'Quiero una pizza grande hawaiana'
);

if (result.success && result.data) {
  console.log('Productos:', result.data.orderItems);
  console.log('Tipo de orden:', result.data.orderType);
  console.log('Entrega:', result.data.deliveryInfo);
  console.log('Horario:', result.data.scheduledDelivery);
}
```

### JavaScript/TypeScript (Node.js)

```typescript
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

class AudioOrderClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async processAudioFile(
    audioFilePath: string,
    transcription: string
  ) {
    const formData = new FormData();
    
    // Agregar archivo de audio
    formData.append('audio', fs.createReadStream(audioFilePath));
    
    // Agregar transcripción
    formData.append('transcription', transcription);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/audio/process-order`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'X-API-Key': this.apiKey
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          error.response?.data?.error?.message || 'Error procesando audio'
        );
      }
      throw error;
    }
  }
}
```

### cURL para Pruebas

```bash
curl -X POST https://api.turestaurante.com/api/v1/audio/process-order \
  -H "X-API-Key: tu-cloud-api-key" \
  -F "audio=@/path/to/audio.mp4" \
  -F "transcription=Quiero dos pizzas grandes hawaianas para las 3 de la tarde"
```

## Manejo de Errores

### Estructura de Error
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    type: string;
    timestamp: string;
    requestId: string;
    details?: any;  // Solo en desarrollo
  };
}
```

### Códigos de Error Comunes

| Código | Mensaje | Descripción |
|--------|---------|-------------|
| `BL002` | Missing required field | Falta el archivo de audio o transcripción |
| `BL015` | File too large | El archivo excede 10MB |
| `BL016` | AI processing error | Error procesando con Gemini |
| `AUTH001` | Invalid API key | API key inválida o faltante |
| `VAL001` | Validation error | Datos de entrada inválidos |
| `TECH001` | Technical error | Error interno del servidor |

### Ejemplo de Manejo de Errores

```typescript
try {
  const result = await processAudioOrder(audioUri, transcription);
  // Procesar resultado exitoso
} catch (error) {
  if (error.response?.data?.error) {
    const apiError = error.response.data.error;
    
    switch (apiError.code) {
      case 'BL015':
        // Archivo muy grande
        alert('El archivo de audio es muy grande. Máximo 10MB.');
        break;
      case 'AUTH001':
        // Error de autenticación
        console.error('API Key inválida');
        break;
      case 'BL016':
        // Error de procesamiento
        alert('No se pudo procesar el audio. Intenta de nuevo.');
        break;
      default:
        alert(apiError.message || 'Error desconocido');
    }
  }
}
```

## Casos de Uso y Escenarios

### 1. Solo Productos (Consumo en Local)
**Audio**: "Quiero dos pizzas grandes hawaianas"
```json
{
  "orderItems": [{
    "productId": "PZ",
    "variantId": "PZ-V-2",
    "quantity": 2,
    "pizzaCustomizations": [{
      "customizationId": "PIZZA-HAWAIANA",
      "half": "FULL",
      "action": "ADD"
    }]
  }],
  "orderType": "DINE_IN"
}
```

### 2. Productos + Dirección (Entrega a Domicilio)
**Audio**: "Una hamburguesa clásica para entregar en Calle Juárez 123, Colonia Centro"
```json
{
  "orderItems": [{
    "productId": "BURG-01",
    "quantity": 1
  }],
  "orderType": "DELIVERY",
  "deliveryInfo": {
    "fullAddress": "Calle Juárez 123, Colonia Centro"
  }
}
```

### 3. Orden para Recoger
**Audio**: "Dos tacos al pastor para recoger a nombre de María González"
```json
{
  "orderItems": [{
    "productId": "TACO-01",
    "quantity": 2
  }],
  "orderType": "TAKE_AWAY",
  "deliveryInfo": {
    "recipientName": "María González"
  }
}
```

### 4. Orden Completa con Horario de Entrega
**Audio**: "Dos tacos al pastor para las 3 de la tarde, entregar en Av. Reforma 500, teléfono 555-1234"
```json
{
  "orderItems": [{
    "productId": "TACO-01",
    "quantity": 2
  }],
  "orderType": "DELIVERY",
  "deliveryInfo": {
    "fullAddress": "Av. Reforma 500",
    "recipientPhone": "555-1234"
  },
  "scheduledDelivery": {
    "time": "15:00"
  }
}
```

### 5. Pizza con Modificaciones
**Audio**: "Pizza mediana mitad hawaiana, mitad pepperoni, sin cebolla"
```json
{
  "orderItems": [{
    "productId": "PZ",
    "variantId": "PZ-V-1",
    "quantity": 1,
    "modifiers": ["NO-ONION"],
    "pizzaCustomizations": [
      {
        "customizationId": "PIZZA-HAWAIANA",
        "half": "HALF_1",
        "action": "ADD"
      },
      {
        "customizationId": "PIZZA-PEPPERONI",
        "half": "HALF_2",
        "action": "ADD"
      }
    ]
  }],
  "orderType": "DINE_IN"
}
```

### 6. Productos No Identificados
**Audio**: "Quiero algo de pollo y una bebida"
```json
{
  "orderItems": [],
  "orderType": "DINE_IN",
  "warnings": "No pude identificar productos específicos. Mencionaste 'algo de pollo' y 'una bebida' pero necesito más detalles."
}
```

## Optimizaciones y Mejores Prácticas

### 1. Transcripción de Calidad
```typescript
// Configuración recomendada para Google Speech-to-Text
const speechConfig = {
  encoding: 'WEBM_OPUS',
  sampleRateHertz: 48000,
  languageCode: 'es-MX',
  enableAutomaticPunctuation: true,
  model: 'latest_long',
  useEnhanced: true
};
```

### 2. Compresión de Audio
```typescript
// Comprimir audio antes de enviar
async function compressAudio(audioUri: string): Promise<string> {
  // Usar bitrate de 64kbps para voz
  const compressedUri = await Audio.compressAudioAsync(
    audioUri,
    {
      bitrate: 64000,
      sampleRate: 16000,
      channels: 1 // Mono es suficiente para voz
    }
  );
  return compressedUri;
}
```

### 3. Retry con Backoff Exponencial
```typescript
async function processWithRetry(
  audioUri: string,
  transcription: string,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await processAudioOrder(audioUri, transcription);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Esperar con backoff exponencial
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 4. Validación Local Previa
```typescript
function validateBeforeSending(audioFile: File, transcription: string) {
  const errors = [];
  
  // Validar tamaño
  if (audioFile.size > 10 * 1024 * 1024) {
    errors.push('Archivo muy grande (máx 10MB)');
  }
  
  // Validar formato
  const supportedTypes = ['audio/mp4', 'audio/mpeg', 'audio/wav'];
  if (!supportedTypes.includes(audioFile.type)) {
    errors.push('Formato de audio no soportado');
  }
  
  // Validar transcripción
  if (!transcription || transcription.trim().length < 5) {
    errors.push('Transcripción muy corta o vacía');
  }
  
  return errors;
}
```

### 5. Caché de Resultados
```typescript
class AudioOrderCache {
  private cache = new Map<string, any>();
  
  generateKey(audioHash: string, transcription: string): string {
    return `${audioHash}_${transcription}`;
  }
  
  async processWithCache(audioUri: string, transcription: string) {
    const audioHash = await this.hashAudio(audioUri);
    const cacheKey = this.generateKey(audioHash, transcription);
    
    // Verificar caché
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Procesar y cachear
    const result = await processAudioOrder(audioUri, transcription);
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  private async hashAudio(audioUri: string): Promise<string> {
    // Implementar hash del archivo
    return 'hash-del-audio';
  }
}
```

## Limitaciones y Consideraciones

### 1. Limitaciones del Sistema

- **Tamaño máximo de audio**: 10MB
- **Formatos soportados**: mp4, mpeg, ogg, wav, webm
- **Timeout de procesamiento**: 30 segundos
- **Solo español**: Optimizado para español mexicano
- **Productos del menú**: Solo identifica productos existentes en la base de datos

### 2. Consideraciones de Precisión

- **Prioridad del audio**: El sistema prioriza el audio sobre la transcripción
- **Números**: Especial atención a cantidades y teléfonos
- **Horarios**: Convierte automáticamente a formato 24 horas
- **Fechas**: NO se extraen fechas, solo horas

### 3. Información No Capturada

El sistema NO captura:
- Fechas (solo horas)
- Métodos de pago
- Descuentos o promociones
- Preferencias de cocción (término de carne, etc.)
- Alergias o restricciones dietéticas

### 4. Mejores Prácticas para Audio

1. **Ambiente silencioso**: Reducir ruido de fondo
2. **Hablar claramente**: Pronunciación clara de productos y números
3. **Pausas naturales**: Entre diferentes partes del pedido
4. **Confirmar números**: Repetir teléfonos y cantidades

### 5. Seguridad

- **No incluir información sensible** en el audio
- **API Key segura**: Nunca exponerla en código cliente
- **HTTPS obligatorio**: Toda comunicación debe ser encriptada
- **Logs**: No registrar contenido de audio o transcripciones

## Apéndice: Respuestas de Ejemplo

### Respuesta Mínima (solo productos)
```json
{
  "success": true,
  "data": {
    "orderItems": [{
      "productId": "TACO-01",
      "quantity": 3
    }],
    "orderType": "DINE_IN"
  }
}
```

### Respuesta con Advertencias
```json
{
  "success": true,
  "data": {
    "orderItems": [{
      "productId": "PIZZA-01",
      "variantId": "PIZZA-01-L",
      "quantity": 1
    }],
    "orderType": "DINE_IN",
    "warnings": "No pude identificar el sabor 'tropical'. Agregué una pizza grande sin sabor específico."
  }
}
```

### Respuesta Vacía (sin productos identificables)
```json
{
  "success": true,
  "data": {
    "orderType": "DINE_IN",
    "warnings": "No pude identificar ningún producto del menú en el audio."
  }
}
```

### Error de Validación
```json
{
  "error": {
    "code": "VAL001",
    "message": "El campo 'transcription' es requerido",
    "type": "VALIDATION",
    "timestamp": "2025-01-20T15:30:45.123Z",
    "requestId": "req_abc123xyz"
  }
}
```

## Contacto y Soporte

Para dudas sobre la integración o solicitar acceso a la API:
- Email: soporte@turestaurante.com
- Documentación: https://docs.turestaurante.com/api/audio
- Status del servicio: https://status.turestaurante.com