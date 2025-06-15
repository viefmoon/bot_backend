import * as winston from 'winston';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(), // Agregar formato JSON
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Si el mensaje es un objeto, convertirlo a string
      const formattedMessage = typeof message === 'object' 
        ? JSON.stringify(message)
        : message;
      
      // Si hay metadata adicional, incluirla en el log
      const metadata = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      
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
