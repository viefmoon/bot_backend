import dotenv from 'dotenv';
import logger from '../utils/logger';
import { ValidationError, ErrorCode } from '../services/errors';

dotenv.config();

interface EnvironmentVariables {
  // Required variables
  DATABASE_URL: string;
  GOOGLE_AI_API_KEY: string;
  WHATSAPP_PHONE_NUMBER_MESSAGING_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;
  FRONTEND_BASE_URL: string;
  GEMINI_MODEL: string;
  EMBEDDING_MODEL: string;
  
  // Optional variables
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  NODE_ENV: string;
  PORT: string;
  RATE_LIMIT_MAX_MESSAGES: string;
  RATE_LIMIT_TIME_WINDOW_MINUTES: string;
  DEFAULT_TIMEZONE: string;
  DEFAULT_LOCALE: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  CLOUD_API_KEY?: string;
  BULLMQ_WORKER_CONCURRENCY?: string;
  NUM_WORKERS?: string;
  LOCAL_BACKEND_URL?: string;
}

class EnvironmentValidator {
  private requiredVars: (keyof EnvironmentVariables)[] = [
    'DATABASE_URL',
    'GOOGLE_AI_API_KEY',
    'WHATSAPP_PHONE_NUMBER_MESSAGING_ID',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_VERIFY_TOKEN',
    'FRONTEND_BASE_URL',
    'GEMINI_MODEL',
    'NODE_ENV',
    'PORT',
    'RATE_LIMIT_MAX_MESSAGES',
    'RATE_LIMIT_TIME_WINDOW_MINUTES',
    'DEFAULT_TIMEZONE',
    'DEFAULT_LOCALE'
  ];

  validate(): void {
    logger.info('Starting environment validation...');
    const missingVars: string[] = [];
    
    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      } else {
        logger.debug(`Environment variable ${varName}: ${varName.includes('KEY') || varName.includes('TOKEN') ? '[REDACTED]' : process.env[varName]}`);
      }
    }
    
    if (missingVars.length > 0) {
      const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
      logger.error(errorMessage);
      throw new ValidationError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        errorMessage,
        { metadata: { missingVars } }
      );
    }
    
    // Validate specific formats
    this.validateDatabaseUrl();
    this.validateUrl('FRONTEND_BASE_URL');
    
    // Log optional variables status
    if (process.env.STRIPE_SECRET_KEY) {
      logger.info('Stripe payment integration is enabled');
    } else {
      logger.warn('Stripe payment integration is disabled (STRIPE_SECRET_KEY not set)');
    }
    
    logger.info('Environment variables validated successfully');
  }
  
  private validateDatabaseUrl(): void {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl?.startsWith('postgresql://')) {
      throw new ValidationError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'DATABASE_URL must be a valid PostgreSQL connection string',
        { metadata: { providedUrl: dbUrl } }
      );
    }
  }
  
  
  private validateUrl(varName: string): void {
    const url = process.env[varName];
    try {
      if (url) {
        new URL(url);
      }
    } catch {
      throw new ValidationError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        `${varName} must be a valid URL`,
        { metadata: { varName, providedUrl: url } }
      );
    }
  }
  
  getEnv(): EnvironmentVariables {
    return {
      DATABASE_URL: process.env.DATABASE_URL!,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY!,
      WHATSAPP_PHONE_NUMBER_MESSAGING_ID: process.env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID!,
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN!,
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN!,
      FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL!,
      GEMINI_MODEL: process.env.GEMINI_MODEL!,
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-004',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      NODE_ENV: process.env.NODE_ENV!,
      PORT: process.env.PORT!,
      RATE_LIMIT_MAX_MESSAGES: process.env.RATE_LIMIT_MAX_MESSAGES!,
      RATE_LIMIT_TIME_WINDOW_MINUTES: process.env.RATE_LIMIT_TIME_WINDOW_MINUTES!,
      DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE!,
      DEFAULT_LOCALE: process.env.DEFAULT_LOCALE!,
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      CLOUD_API_KEY: process.env.CLOUD_API_KEY,
      BULLMQ_WORKER_CONCURRENCY: process.env.BULLMQ_WORKER_CONCURRENCY,
      NUM_WORKERS: process.env.NUM_WORKERS
    };
  }
}

export const envValidator = new EnvironmentValidator();
export const env = envValidator.getEnv();