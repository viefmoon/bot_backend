import { Request, Response, NextFunction } from 'express';
import { TechnicalError, ErrorCode } from '../services/errors';
import logger from '../utils/logger';

export interface CloudAuthRequest extends Request {
  cloudApiKey?: string;
}

export async function cloudAuthMiddleware(
  req: CloudAuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new TechnicalError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'API key required for cloud operations'
      );
    }
    
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
    
    req.cloudApiKey = apiKey;
    
    next();
  } catch (error) {
    next(error);
  }
}