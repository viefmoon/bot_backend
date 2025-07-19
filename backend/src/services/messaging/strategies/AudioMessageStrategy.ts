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
      const fullMimeType = context.message.audio.mime_type || 'audio/ogg';
      // Extract base MIME type without parameters (e.g., "audio/ogg" from "audio/ogg; codecs=opus")
      const mimeType = fullMimeType.split(';')[0].trim();
      const validMimeTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'];
      
      if (!validMimeTypes.includes(mimeType)) {
        throw new ValidationError(
          ErrorCode.TRANSCRIPTION_ERROR,
          `Unsupported audio format: ${mimeType}`,
          { metadata: { mimeType: fullMimeType, baseMimeType: mimeType, validMimeTypes } }
        );
      }
      
      // Convertir a base64
      const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
      
      // Transcribir con el servicio centralizado de Gemini
      const transcription = await GeminiService.transcribeAudio(audioBase64, mimeType);
      
      logger.info(`Audio transcribed successfully: "${transcription}"`);
      
      // Store the transcription in the message context so it gets saved to history
      // This simulates a text message structure for the pipeline
      context.message.text = {
        body: transcription
      };
      
      // Change the message type to text so it gets processed by TextMessageStrategy
      context.message.type = 'text';
      
      // Mark that we already sent an initial response
      context.set('audio_transcribed', true);
      
      // DON'T stop the pipeline - let it continue processing as a text message
      // This ensures the history gets updated properly
      
    } catch (error) {
      logger.error('Error processing audio message:', error);
      await sendWhatsAppMessage(context.message.from, AUDIO_TRANSCRIPTION_ERROR);
      context.stop();
    }
  }
}