import { Router } from 'express';
import multer from 'multer';
import { AudioOrderController } from './audioOrder.controller';
import { AudioHealthController } from './audioHealth.controller';
import { apiKeyAuthMiddleware } from '../../common/middlewares/apiKeyAuth.middleware';
// Removed validation middleware - not needed for audio-only processing
import { asyncHandler } from '../../common/middlewares/errorHandler';
// No DTO validation needed - only audio file validation via multer

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
  apiKeyAuthMiddleware,
  asyncHandler(AudioHealthController.checkHealth)
);

// Process audio order endpoint
router.post(
  '/process-order',
  apiKeyAuthMiddleware,
  upload.single('audio'),
  asyncHandler(AudioOrderController.processAudioOrder)
);

export default router;