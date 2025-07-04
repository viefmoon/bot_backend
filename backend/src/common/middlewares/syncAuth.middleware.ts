import { Request, Response, NextFunction } from 'express';
import { TechnicalError, ErrorCode } from '../services/errors';
import logger from '../utils/logger';

export interface SyncAuthRequest extends Request {
  syncApiKey?: string;
}

export async function syncAuthMiddleware(
  req: SyncAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new TechnicalError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'API key required for sync operations'
      );
    }
    
    // Validate API key against environment variable
    const validApiKey = process.env.CLOUD_API_KEY;
    
    if (!validApiKey) {
      logger.error('CLOUD_API_KEY not configured in environment');
      throw new TechnicalError(
        ErrorCode.DATABASE_ERROR,
        'Cloud API key not configured'
      );
    }
    
    if (apiKey !== validApiKey) {
      throw new TechnicalError(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid API key'
      );
    }
    
    // Store API key in request for logging
    req.syncApiKey = apiKey;
    
    next();
  } catch (error) {
    next(error);
  }
}