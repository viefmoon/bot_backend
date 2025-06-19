import * as winston from 'winston';
import { env } from '../config/envValidator';

// Helper function to format JSON for better readability
const formatJSON = (obj: any, indent = 2): string => {
  try {
    if (typeof obj === 'string') {
      // Try to parse if it's a JSON string
      try {
        const parsed = JSON.parse(obj);
        return JSON.stringify(parsed, null, indent);
      } catch {
        return obj;
      }
    }
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    return String(obj);
  }
};

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Helper function to safely stringify objects with circular references
      const safeStringify = (obj: any, indent = 0): string => {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular Reference]';
            }
            seen.add(value);
          }
          return value;
        }, indent);
      };
      
      // Si el mensaje es un objeto, convertirlo a string
      const formattedMessage = typeof message === 'object' 
        ? safeStringify(message, 2)
        : String(message);
      
      // Si hay metadata adicional, incluirla en el log
      const metadata = Object.keys(meta).length ? `\n${safeStringify(meta, 2)}` : '';
      
      return `${timestamp} [${level}]: ${formattedMessage}${metadata}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add helper methods for JSON logging
(logger as any).json = function(message: string, data: any) {
  this.debug(`${message}\n${formatJSON(data)}`);
};

(logger as any).jsonInfo = function(message: string, data: any) {
  this.info(`${message}\n${formatJSON(data)}`);
};

export default logger;
