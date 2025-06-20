import { prisma } from '../../server';
import { RestaurantConfig, BusinessHours } from '../../common/types';
import logger from '../../common/utils/logger';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';
import { redisService } from '../redis/RedisService';

/**
 * Service for managing restaurant configuration and business hours
 */
export class RestaurantService {
  // Redis cache keys
  private static readonly REDIS_CONFIG_KEY = 'restaurant:config';
  private static readonly REDIS_BUSINESS_HOURS_KEY = 'restaurant:business_hours';
  private static readonly CACHE_TTL = 300; // 5 minutes cache
  
  // Memory cache fallback
  private static memoryConfigCache: RestaurantConfig | null = null;
  private static memoryBusinessHoursCache: BusinessHours[] | null = null;

  /**
   * Get restaurant configuration (with caching)
   */
  static async getConfig(): Promise<RestaurantConfig> {
    try {
      // Try Redis cache first
      if (redisService.isAvailable()) {
        const cached = await redisService.getJSON<RestaurantConfig>(this.REDIS_CONFIG_KEY);
        if (cached) {
          logger.debug('Restaurant config retrieved from Redis cache');
          return cached;
        }
      }
      
      // Try memory cache
      if (this.memoryConfigCache) {
        logger.debug('Restaurant config retrieved from memory cache');
        return this.memoryConfigCache;
      }

      // Get or create config from database
      let config = await prisma.restaurantConfig.findFirst();
      
      if (!config) {
        config = await prisma.restaurantConfig.create({
          data: {
            acceptingOrders: true,
            estimatedPickupTime: 20,
            estimatedDeliveryTime: 40
          }
        });
        logger.info('Created default restaurant configuration');
      }

      // Cache in Redis if available
      if (redisService.isAvailable()) {
        await redisService.setJSON(this.REDIS_CONFIG_KEY, config, this.CACHE_TTL);
      }
      
      // Cache in memory
      this.memoryConfigCache = config;
      return config;
    } catch (error) {
      logger.error('Error getting restaurant config:', error);
      // Return default config if error
      return {
        id: 1,
        acceptingOrders: true,
        estimatedPickupTime: 20,
        estimatedDeliveryTime: 40
      } as RestaurantConfig;
    }
  }

  /**
   * Update restaurant configuration
   */
  static async updateConfig(data: Partial<RestaurantConfig>): Promise<RestaurantConfig> {
    try {
      const config = await prisma.restaurantConfig.findFirst();
      
      if (!config) {
        throw new BusinessLogicError(
          ErrorCode.ORDER_NOT_FOUND,
          'Restaurant configuration not found'
        );
      }

      const { id, ...updateData } = data;
      const updated = await prisma.restaurantConfig.update({
        where: { id: config.id },
        data: updateData as any
      });

      // Clear caches
      await this.clearCache();
      
      // Clear timezone cache if timezone was updated
      if (data.timeZone) {
        const { clearTimeZoneCache } = await import('../../common/utils/timeUtils');
        clearTimeZoneCache();
      }

      logger.info('Restaurant configuration updated:', data);
      return updated;
    } catch (error) {
      logger.error('Error updating restaurant config:', error);
      throw error;
    }
  }

  /**
   * Toggle accepting orders
   */
  static async toggleAcceptingOrders(accepting: boolean): Promise<RestaurantConfig> {
    return this.updateConfig({ acceptingOrders: accepting });
  }

  /**
   * Get business hours for a specific day
   */
  static async getBusinessHoursForDay(dayOfWeek: number): Promise<BusinessHours | null> {
    try {
      const config = await this.getConfig();
      
      const businessHours = await prisma.businessHours.findUnique({
        where: {
          restaurantConfigId_dayOfWeek: {
            restaurantConfigId: config.id,
            dayOfWeek: dayOfWeek
          }
        }
      });

      return businessHours;
    } catch (error) {
      logger.error(`Error getting business hours for day ${dayOfWeek}:`, error);
      return null;
    }
  }

  /**
   * Get all business hours
   */
  static async getAllBusinessHours(): Promise<BusinessHours[]> {
    try {
      // Try Redis cache first
      if (redisService.isAvailable()) {
        const cached = await redisService.getJSON<BusinessHours[]>(this.REDIS_BUSINESS_HOURS_KEY);
        if (cached) {
          logger.debug('Business hours retrieved from Redis cache');
          return cached;
        }
      }
      
      // Try memory cache
      if (this.memoryBusinessHoursCache) {
        logger.debug('Business hours retrieved from memory cache');
        return this.memoryBusinessHoursCache;
      }

      const config = await this.getConfig();
      const businessHours = await prisma.businessHours.findMany({
        where: { restaurantConfigId: config.id },
        orderBy: { dayOfWeek: 'asc' }
      });

      // Cache in Redis if available
      if (redisService.isAvailable()) {
        await redisService.setJSON(this.REDIS_BUSINESS_HOURS_KEY, businessHours, this.CACHE_TTL);
      }
      
      // Cache in memory
      this.memoryBusinessHoursCache = businessHours;
      return businessHours;
    } catch (error) {
      logger.error('Error getting all business hours:', error);
      return [];
    }
  }

  /**
   * Update business hours for a specific day
   */
  static async updateBusinessHours(
    dayOfWeek: number, 
    data: { openingTime?: string; closingTime?: string; isClosed?: boolean }
  ): Promise<BusinessHours> {
    try {
      const config = await this.getConfig();

      const businessHours = await prisma.businessHours.upsert({
        where: {
          restaurantConfigId_dayOfWeek: {
            restaurantConfigId: config.id,
            dayOfWeek
          }
        },
        update: data,
        create: {
          restaurantConfigId: config.id,
          dayOfWeek,
          ...data
        }
      });

      // Clear caches
      await this.clearCache();
      
      logger.info(`Updated business hours for day ${dayOfWeek}:`, data);
      return businessHours;
    } catch (error) {
      logger.error('Error updating business hours:', error);
      throw new BusinessLogicError(
        ErrorCode.DATABASE_ERROR,
        'Failed to update business hours',
        { metadata: { dayOfWeek, data } }
      );
    }
  }

  /**
   * Check if restaurant is currently open
   */
  static async isOpen(date: Date = new Date()): Promise<boolean> {
    try {
      const dayOfWeek = date.getDay();
      const businessHours = await this.getBusinessHoursForDay(dayOfWeek);

      if (!businessHours || businessHours.isClosed || !businessHours.openingTime || !businessHours.closingTime) {
        return false;
      }

      const currentTime = date.getHours() * 60 + date.getMinutes();
      const [openHour, openMinute] = businessHours.openingTime.split(':').map(Number);
      const [closeHour, closeMinute] = businessHours.closingTime.split(':').map(Number);
      
      const openTime = openHour * 60 + openMinute;
      const closeTime = closeHour * 60 + closeMinute;

      return currentTime >= openTime && currentTime <= closeTime;
    } catch (error) {
      logger.error('Error checking if restaurant is open:', error);
      return false;
    }
  }

  /**
   * Clear all caches
   */
  static async clearCache(): Promise<void> {
    // Clear Redis cache if available
    if (redisService.isAvailable()) {
      await redisService.del(this.REDIS_CONFIG_KEY);
      await redisService.del(this.REDIS_BUSINESS_HOURS_KEY);
    }
    
    // Clear memory cache
    this.memoryConfigCache = null;
    this.memoryBusinessHoursCache = null;
    logger.debug('Restaurant service caches cleared');
  }

  /**
   * Get delivery coverage area
   */
  static async getDeliveryCoverageArea(): Promise<any> {
    const config = await this.getConfig();
    return config.deliveryCoverageArea;
  }

  /**
   * Update delivery coverage area
   */
  static async updateDeliveryCoverageArea(coverageArea: any): Promise<RestaurantConfig> {
    return this.updateConfig({ deliveryCoverageArea: coverageArea });
  }
}