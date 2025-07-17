import { Request, Response } from 'express';
import { GeminiService } from '../../services/ai/GeminiService';
import { prisma } from '../../lib/prisma';
import logger from '../../common/utils/logger';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  message: string;
  timestamp: string;
  services: {
    server: 'healthy' | 'unhealthy';
    database: 'connected' | 'disconnected';
    ai: 'connected' | 'disconnected';
    embeddings: 'available' | 'unavailable';
  };
}

export class AudioHealthController {
  static async checkHealth(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const services: HealthCheckResponse['services'] = {
      server: 'healthy',
      database: 'disconnected',
      ai: 'disconnected',
      embeddings: 'unavailable'
    };

    try {
      // Check database connection
      try {
        await prisma.$queryRaw`SELECT 1`;
        services.database = 'connected';
        logger.debug('Health check: Database connected');
      } catch (error) {
        logger.error('Health check: Database connection failed', { error });
      }

      // Check AI service (Gemini)
      try {
        // Simple test to verify Gemini is accessible
        const testPrompt = 'Hello';
        const response = await Promise.race([
          GeminiService.generateContentWithHistory(
            [{ role: 'user', parts: [{ text: testPrompt }] }],
            'You are a health check bot. Reply with "ok".',
            []
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI service timeout')), 3000)
          )
        ]);
        
        if (response) {
          services.ai = 'connected';
          logger.debug('Health check: AI service connected');
        }
      } catch (error) {
        logger.error('Health check: AI service connection failed', { error });
      }

      // Check embeddings availability
      try {
        // Check if embeddings table has data
        const embeddingsCount = await prisma.product.count({
          where: {
            embeddingVector: { not: null }
          }
        });
        
        if (embeddingsCount > 0) {
          services.embeddings = 'available';
          logger.debug('Health check: Embeddings available', { count: embeddingsCount });
        }
      } catch (error) {
        logger.error('Health check: Embeddings check failed', { error });
      }

      // Determine overall status
      const allServicesHealthy = 
        services.database === 'connected' && 
        services.ai === 'connected' &&
        services.embeddings === 'available';

      const status: HealthCheckResponse['status'] = allServicesHealthy ? 'ok' : 'error';
      const message = allServicesHealthy 
        ? 'Audio processing service is healthy'
        : `Service degraded: ${Object.entries(services)
            .filter(([_, status]) => status !== 'connected' && status !== 'healthy' && status !== 'available')
            .map(([service]) => service)
            .join(', ')} not available`;

      const responseTime = Date.now() - startTime;
      logger.info('Health check completed', { 
        status, 
        services, 
        responseTime 
      });

      const response: HealthCheckResponse = {
        status,
        message,
        timestamp: new Date().toISOString(),
        services
      };

      res.status(status === 'ok' ? 200 : 503).json(response);
    } catch (error) {
      logger.error('Health check failed with unexpected error', { error });
      
      const response: HealthCheckResponse = {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        services
      };
      
      res.status(503).json(response);
    }
  }
}