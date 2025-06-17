import * as winston from 'winston';
import { env } from '../config/envValidator';

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(), // Agregar formato JSON
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Helper function to safely stringify objects with circular references
      const safeStringify = (obj: any): string => {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular Reference]';
            }
            seen.add(value);
          }
          return value;
        });
      };
      
      // Si el mensaje es un objeto, convertirlo a string
      const formattedMessage = typeof message === 'object' 
        ? safeStringify(message)
        : message;
      
      // Si hay metadata adicional, incluirla en el log
      const metadata = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';
      
      return `${timestamp} [${level}]: ${formattedMessage}${metadata}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export default logger;
