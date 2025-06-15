import { prisma } from '../server';
import { RestaurantConfig } from '@prisma/client';
import logger from '../utils/logger';

let configCache: RestaurantConfig | null = null;

export async function getRestaurantConfig(): Promise<RestaurantConfig> {
  try {
    // Return cached config if available
    if (configCache) {
      return configCache;
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
    }

    configCache = config;
    return config;
  } catch (error) {
    logger.error('Error getting restaurant config:', error);
    // Return default config if error
    return {
      id: 1,
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40
    };
  }
}

export async function updateRestaurantConfig(data: Partial<RestaurantConfig>): Promise<RestaurantConfig> {
  try {
    const config = await prisma.restaurantConfig.findFirst();
    
    if (!config) {
      throw new Error('Restaurant config not found');
    }

    const updated = await prisma.restaurantConfig.update({
      where: { id: config.id },
      data
    });

    // Clear cache
    configCache = null;

    return updated;
  } catch (error) {
    logger.error('Error updating restaurant config:', error);
    throw error;
  }
}

export async function toggleAcceptingOrders(accepting: boolean): Promise<RestaurantConfig> {
  return updateRestaurantConfig({ acceptingOrders: accepting });
}