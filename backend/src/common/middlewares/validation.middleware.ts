import { plainToInstance } from 'class-transformer';
import { validate, ValidationError as ClassValidationError } from 'class-validator';
import { RequestHandler } from 'express';
import { ValidationError, ErrorCode } from '../services/errors';

/**
 * Middleware para validar automáticamente DTOs usando class-validator
 * @param type La clase DTO a validar
 * @param skipMissingProperties Si se deben omitir propiedades faltantes (default: false)
 * @returns Express middleware
 */
export function validationMiddleware(
  type: any,
  skipMissingProperties = false
): RequestHandler {
  return async (req, _res, next) => {
    try {
      // Transformar el body a la instancia del DTO
      const dto = plainToInstance(type, req.body);
      
      // Validar el DTO
      const errors: ClassValidationError[] = await validate(dto as object, {
        skipMissingProperties,
        whitelist: true, // Remover propiedades no definidas en el DTO
        forbidNonWhitelisted: true, // Lanzar error si hay propiedades no definidas
      });

      if (errors.length > 0) {
        // Formatear mensajes de error
        const messages = errors.map((error: ClassValidationError) => {
          const constraints = error.constraints || {};
          return `${error.property}: ${Object.values(constraints).join(', ')}`;
        });
        
        next(new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Validation failed: ${messages.join('; ')}`
        ));
      } else {
        // Reemplazar req.body con el DTO validado y transformado
        req.body = dto;
        next();
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware para validar query parameters
 */
export function queryValidationMiddleware(
  type: any,
  skipMissingProperties = false
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const dto = plainToInstance(type, req.query);
      const errors: ClassValidationError[] = await validate(dto as object, {
        skipMissingProperties,
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        const messages = errors.map((error: ClassValidationError) => {
          const constraints = error.constraints || {};
          return `${error.property}: ${Object.values(constraints).join(', ')}`;
        });
        
        next(new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Query validation failed: ${messages.join('; ')}`
        ));
      } else {
        req.query = dto as any;
        next();
      }
    } catch (error) {
      next(error);
    }
  };
}