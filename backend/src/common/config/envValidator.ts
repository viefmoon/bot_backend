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
  BOT_WHATSAPP_NUMBER: string;
  FRONTEND_BASE_URL: string;
  GEMINI_MODEL: string;
  
  // Optional variables
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  NODE_ENV?: string;
  PORT?: string;
  RATE_LIMIT_MAX_MESSAGES?: string;
  RATE_LIMIT_TIME_WINDOW_MINUTES?: string;
}

class EnvironmentValidator {
  private requiredVars: (keyof EnvironmentVariables)[] = [
    'DATABASE_URL',
    'GOOGLE_AI_API_KEY',
    'WHATSAPP_PHONE_NUMBER_MESSAGING_ID',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_VERIFY_TOKEN',
    'BOT_WHATSAPP_NUMBER',
    'FRONTEND_BASE_URL',
    'GEMINI_MODEL'
  ];

  validate(): void {
    const missingVars: string[] = [];
    
    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
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
    this.validateWhatsAppNumber();
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
  
  private validateWhatsAppNumber(): void {
    const number = process.env.BOT_WHATSAPP_NUMBER;
    if (!number?.match(/^\d{10,15}$/)) {
      throw new ValidationError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'BOT_WHATSAPP_NUMBER must be a valid phone number (10-15 digits)',
        { metadata: { providedNumber: number } }
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
      BOT_WHATSAPP_NUMBER: process.env.BOT_WHATSAPP_NUMBER!,
      FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL!,
      GEMINI_MODEL: process.env.GEMINI_MODEL!,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '5000',
      RATE_LIMIT_MAX_MESSAGES: process.env.RATE_LIMIT_MAX_MESSAGES || '30',
      RATE_LIMIT_TIME_WINDOW_MINUTES: process.env.RATE_LIMIT_TIME_WINDOW_MINUTES || '5'
    };
  }
}

export const envValidator = new EnvironmentValidator();
export const env = envValidator.getEnv();