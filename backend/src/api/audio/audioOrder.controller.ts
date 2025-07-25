import { Request, Response } from 'express';
import { AudioOrderService } from '../../services/audio/AudioOrderService';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';
import logger from '../../common/utils/logger';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export class AudioOrderController {
  static async processAudioOrder(req: MulterRequest, res: Response): Promise<void> {
    if (!req.file) {
      throw new BusinessLogicError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'El archivo de audio es requerido'
      );
    }
    

    const result = await AudioOrderService.processAudioOrder({
      audioBuffer: req.file.buffer,
      audioMimeType: req.file.mimetype
    });

    res.status(200).json({
      success: true,
      data: {
        orderItems: result.orderItems,
        orderType: result.orderType,
        deliveryInfo: result.deliveryInfo,
        scheduledDelivery: result.scheduledDelivery,
        warnings: result.warnings
      }
    });
  }
}