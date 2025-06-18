import { prisma } from '../../server';
import { RestaurantConfig, BusinessHours } from '../../common/types';
import logger from '../../common/utils/logger';
import { BusinessLogicError, ErrorCode } from '../../common/services/errors';

/**
 * Service for managing restaurant configuration and business hours
 */
export class RestaurantService {
  private static configCache: RestaurantConfig | null = null;
  private static businessHoursCache: BusinessHours[] | null = null;

  /**
   * Get restaurant configuration (with caching)
   */
  static async getConfig(): Promise<RestaurantConfig> {
    try {
      // Return cached config if available
      if (this.configCache) {
        return this.configCache;
      }

      // Get or create config
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

      this.configCache = config;
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
      this.clearCache();
      
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
      if (this.businessHoursCache) {
        return this.businessHoursCache;
      }

      const config = await this.getConfig();
      const businessHours = await prisma.businessHours.findMany({
        where: { restaurantConfigId: config.id },
        orderBy: { dayOfWeek: 'asc' }
      });

      this.businessHoursCache = businessHours;
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

      // Clear cache
      this.businessHoursCache = null;
      
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
  static clearCache(): void {
    this.configCache = null;
    this.businessHoursCache = null;
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