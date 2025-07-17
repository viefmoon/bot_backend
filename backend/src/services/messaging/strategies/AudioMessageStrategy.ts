import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { GeminiService } from '../../ai';
import { sendWhatsAppMessage, getWhatsAppMediaUrl } from '../../whatsapp';
import { AUDIO_TRANSCRIPTION_ERROR } from '../../../common/config/predefinedMessages';
import { TextProcessingService } from '../TextProcessingService';
import logger from '../../../common/utils/logger';
import { env } from '../../../common/config/envValidator';
import axios from 'axios';
import { ValidationError, ErrorCode } from '../../../common/services/errors';

export class AudioMessageStrategy extends MessageStrategy {
  name = 'AudioMessageStrategy';
  
  canHandle(context: MessageContext): boolean {
    return context.message.type === 'audio';
  }
  
  async execute(context: MessageContext): Promise<void> {
    if (!context.message.audio) return;
    
    try {
      logger.info(`Processing audio message from ${context.message.from}`);
      
      // Notificar al usuario que estamos procesando
      await sendWhatsAppMessage(
        context.message.from,
        "🎤 Recibí tu mensaje de voz. Dame un momento mientras lo proceso..."
      );
      
      // Obtener URL del audio
      const audioUrl = await getWhatsAppMediaUrl(context.message.audio.id);
      if (!audioUrl) {
        throw new ValidationError(
          ErrorCode.WHATSAPP_API_ERROR,
          'Could not get audio URL',
          { metadata: { audioId: context.message.audio.id } }
        );
      }
      
      // Descargar audio
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
        },
        timeout: 30000
      });
      
      // Determinar tipo MIME
      const mimeType = context.message.audio.mime_type || 'audio/ogg';
      const validMimeTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'];
      
      if (!validMimeTypes.includes(mimeType)) {
        throw new ValidationError(
          ErrorCode.TRANSCRIPTION_ERROR,
          `Unsupported audio format: ${mimeType}`,
          { metadata: { mimeType, validMimeTypes } }
        );
      }
      
      // Convertir a base64
      const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
      
      // Transcribir con el servicio centralizado de Gemini
      const transcription = await GeminiService.transcribeAudio(audioBase64, mimeType);
      
      logger.info(`Audio transcribed successfully: "${transcription}"`);
      
      // Notificar al usuario de la transcripción
      await sendWhatsAppMessage(
        context.message.from,
        `🎤 Entendí: "${transcription}"\n\nProcesando tu mensaje...`
      );
      
      // Process the transcribed text directly using the shared service
      await TextProcessingService.processTextMessage(transcription, context);
      
      // Stop the pipeline here since we've already processed the message
      context.stop();
      
    } catch (error) {
      logger.error('Error processing audio message:', error);
      await sendWhatsAppMessage(context.message.from, AUDIO_TRANSCRIPTION_ERROR);
      context.stop();
    }
  }
}