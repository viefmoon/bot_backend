import { BusinessLogicError, ErrorCode } from '../../common/services/errors';
import { AudioOrderProcessor, AudioProcessingResult } from './AudioOrderProcessor';
import logger from '../../common/utils/logger';

interface ProcessAudioParams {
  audioBuffer: Buffer;
  audioMimeType: string;
}

export class AudioOrderService {
  private static readonly MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Main entry point for processing audio orders
   */
  static async processAudioOrder(params: ProcessAudioParams): Promise<AudioProcessingResult> {
    try {
      logger.info('Starting audio order processing', {
        audioSize: params.audioBuffer.length,
        mimeType: params.audioMimeType
      });

      // Validate audio size
      this.validateAudioSize(params.audioBuffer);

      // Prepare audio for processing
      const audioBase64 = this.prepareAudioBase64(params.audioBuffer);

      // Process with AI
      const extractedData = await AudioOrderProcessor.processWithGemini({
        audioBase64,
        audioMimeType: params.audioMimeType
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

  /**
   * Validates audio file size
   */
  private static validateAudioSize(audioBuffer: Buffer): void {
    if (audioBuffer.length > this.MAX_AUDIO_SIZE) {
      throw new BusinessLogicError(
        ErrorCode.FILE_TOO_LARGE,
        'El archivo de audio es demasiado grande. Máximo 10MB permitido.'
      );
    }
  }

  /**
   * Converts audio buffer to base64 string
   */
  private static prepareAudioBase64(audioBuffer: Buffer): string {
    return audioBuffer.toString('base64');
  }



}