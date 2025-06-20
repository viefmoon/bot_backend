import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import { RestaurantInfo } from '../../common/types/restaurant';

interface CachedConfig {
  restaurantInfo: RestaurantInfo;
  lastUpdated: Date;
}

/**
 * Service for managing and caching global configuration
 */
export class ConfigService {
  private static config: CachedConfig | null = null;
  private static readonly CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache TTL
  private static reloadInProgress = false;

  /**
   * Loads the restaurant configuration from database and caches it
   */
  static async loadConfig(): Promise<void> {
    try {
      const dbConfig = await prisma.restaurantConfig.findFirst();
      
      if (!dbConfig) {
        throw new Error('Restaurant configuration not found in database');
      }
      
      // Map database config to RestaurantInfo type
      const restaurantInfo: RestaurantInfo = {
        restaurantName: dbConfig.restaurantName || "Establecimiento",
        phoneMain: dbConfig.phoneMain || "",
        phoneSecondary: dbConfig.phoneSecondary || "",
        address: dbConfig.address || "",
        city: dbConfig.city || "",
        state: dbConfig.state || "",
        postalCode: dbConfig.postalCode || ""
      };
      
      this.config = {
        restaurantInfo,
        lastUpdated: new Date()
      };
      
      logger.info('Restaurant configuration loaded and cached successfully');
    } catch (error) {
      logger.error('Failed to load restaurant configuration:', error);
      throw error;
    }
  }

  /**
   * Gets the cached restaurant configuration
   * Auto-reloads if cache has expired
   * @throws Error if configuration cannot be loaded
   */
  static getConfig(): RestaurantInfo {
    // Check if we need to load or reload
    if (!this.config) {
      throw new Error('Configuration not loaded! Call loadConfig() first.');
    }
    
    // Check if cache has expired
    const now = new Date();
    const cacheAge = now.getTime() - this.config.lastUpdated.getTime();
    
    if (cacheAge > this.CACHE_TTL_MS) {
      logger.warn(`Configuration cache expired (age: ${Math.round(cacheAge / 1000)}s), reloading...`);
      // Return stale config but trigger async reload for next request
      this.reloadConfigAsync();
    }
    
    return this.config.restaurantInfo;
  }

  /**
   * Gets the configuration asynchronously, loading it if necessary
   * Useful for startup scenarios where config might not be loaded yet
   */
  static async getConfigAsync(): Promise<RestaurantInfo> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.getConfig();
  }

  /**
   * Forces a reload of the configuration from database
   * Useful after configuration updates
   */
  static async reloadConfig(): Promise<void> {
    logger.info('Reloading restaurant configuration...');
    await this.loadConfig();
  }

  /**
   * Reloads configuration asynchronously without blocking
   * Used for automatic cache refresh
   */
  private static async reloadConfigAsync(): Promise<void> {
    // Prevent multiple concurrent reloads
    if (this.reloadInProgress) {
      logger.debug('Configuration reload already in progress, skipping');
      return;
    }

    this.reloadInProgress = true;
    
    try {
      await this.loadConfig();
      logger.info('Configuration reloaded successfully in background');
    } catch (error) {
      logger.error('Failed to reload configuration in background:', error);
      // Don't throw - continue using stale config
    } finally {
      this.reloadInProgress = false;
    }
  }

  /**
   * Checks if configuration is loaded
   */
  static isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Gets the last update timestamp of the cached configuration
   */
  static getLastUpdated(): Date | null {
    return this.config?.lastUpdated || null;
  }

  /**
   * Gets the cache status information
   */
  static getCacheStatus(): {
    isLoaded: boolean;
    lastUpdated: Date | null;
    ageInSeconds: number | null;
    isExpired: boolean;
    ttlSeconds: number;
  } {
    if (!this.config) {
      return {
        isLoaded: false,
        lastUpdated: null,
        ageInSeconds: null,
        isExpired: false,
        ttlSeconds: this.CACHE_TTL_MS / 1000
      };
    }

    const now = new Date();
    const ageMs = now.getTime() - this.config.lastUpdated.getTime();
    
    return {
      isLoaded: true,
      lastUpdated: this.config.lastUpdated,
      ageInSeconds: Math.round(ageMs / 1000),
      isExpired: ageMs > this.CACHE_TTL_MS,
      ttlSeconds: this.CACHE_TTL_MS / 1000
    };
  }
}