import { Router } from 'express';
import multer from 'multer';
import { AudioOrderController } from './audioOrder.controller';
import { AudioHealthController } from './audioHealth.controller';
import { cloudAuthMiddleware } from '../../common/middlewares/cloudAuth.middleware';
import { validationMiddleware } from '../../common/middlewares/validation.middleware';
import { asyncHandler } from '../../common/middlewares/errorHandler';
import { ProcessAudioOrderDto } from './dto/processAudioOrder.dto';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Use MP4, MP3, OGG, WAV o WEBM.'));
    }
  }
});

// Health check endpoint
router.get(
  '/health',
  cloudAuthMiddleware,
  asyncHandler(AudioHealthController.checkHealth)
);

// Process audio order endpoint
router.post(
  '/process-order',
  cloudAuthMiddleware,
  upload.single('audio'),
  validationMiddleware(ProcessAudioOrderDto),
  asyncHandler(AudioOrderController.processAudioOrder)
);

export default router;