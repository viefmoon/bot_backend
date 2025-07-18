import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import { SyncMetadataService } from './SyncMetadataService';

interface PullChangesResponse {
  pending_orders: any[];
  updated_customers: any[];
}

interface LocalSystemResponse {
  statusCode?: number;
  message?: string;
  menu?: {
    categories: any[];
    lastUpdated: string;
  };
  config?: {
    restaurantConfig: any;
    businessHours: any[];
    lastUpdated: string;
  };
  // Direct structure from local system (alternative format)
  restaurantConfig?: any;
  businessHours?: any[];
  categories?: any[];
  timestamp?: string;
  lastUpdated?: string;
}

export class UnifiedSyncService {
  /**
   * Process restaurant data pushed from local system
   */
  static async processRestaurantDataPush(data: LocalSystemResponse): Promise<boolean> {
    logger.info('Processing restaurant data push', {
      hasDirectConfig: !!data.restaurantConfig,
      hasDirectBusinessHours: !!data.businessHours,
      hasNestedConfig: !!data.config,
      hasMenu: !!data.menu || !!data.categories
    });
    
    try {
      // Normalize the data structure to handle both formats
      const normalizedData: LocalSystemResponse = {
        ...data
      };
      
      // If data comes with direct structure, normalize it
      if (!normalizedData.config && (data.restaurantConfig || data.businessHours)) {
        normalizedData.config = {
          restaurantConfig: data.restaurantConfig,
          businessHours: data.businessHours || [],
          lastUpdated: data.lastUpdated || new Date().toISOString()
        };
      }
      
      if (!normalizedData.menu && data.categories) {
        normalizedData.menu = {
          categories: data.categories,
          lastUpdated: data.lastUpdated || new Date().toISOString()
        };
      }
      
      // Check if data has changed
      const existingConfig = await prisma.restaurantConfig.findFirst();
      const existingMenu = await prisma.category.findMany();
      
      // Simple change detection
      const configData = normalizedData.config?.restaurantConfig;
      const categoriesData = normalizedData.menu?.categories;
      
      const configChanged = !existingConfig || JSON.stringify(existingConfig) !== JSON.stringify(configData);
      const menuChanged = !categoriesData || existingMenu.length !== categoriesData.length;
      
      if (!configChanged && !menuChanged) {
        logger.info('No changes detected in restaurant data');
        return false;
      }
      
      // Process the data
      await this.processRestaurantData(normalizedData);
      logger.info('Restaurant data processed successfully');
      return true;
    } catch (error) {
      logger.error('Error processing restaurant data push:', error);
      throw error;
    }
  }

  /**
   * Pull all pending changes without token complexity
   */
  static async pullChanges(): Promise<PullChangesResponse> {
    logger.info('UnifiedSync: Pull changes requested');
    
    // Get pending items
    const pendingOrders = await SyncMetadataService.getPendingSync('Order');
    const pendingCustomers = await SyncMetadataService.getPendingSync('Customer');
    
    const orderIds = pendingOrders.map(p => p.entityId);
    const customerIds = pendingCustomers.map(p => p.entityId);
    
    // Fetch full order data
    const orders = await this.fetchPendingOrders(orderIds);
    
    // Fetch full customer data  
    const customers = await this.fetchPendingCustomers(customerIds);
    
    logger.info('UnifiedSync: Prepared changes', {
      orderCount: orders.length,
      customerCount: customers.length
    });
    
    return {
      pending_orders: orders,
      updated_customers: customers
    };
  }

  /**
   * Fetch pending orders with full data
   */
  private static async fetchPendingOrders(orderIds: string[]): Promise<any[]> {
    if (orderIds.length === 0) {
      return [];
    }
    
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        isFromWhatsApp: true
      },
      include: {
        customer: true,
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            productModifiers: true
          }
        },
        deliveryInfo: true,
        payments: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    // Transform to expected format
    return orders.map(order => ({
      id: order.id,
      dailyNumber: order.dailyNumber,
      orderType: order.orderType,
      orderStatus: order.orderStatus,
      paymentStatus: order.payments[0]?.status || 'PENDING',
      subtotal: order.subtotal,
      total: order.total,
      paymentMethod: order.payments[0]?.paymentMethod || 'CASH',
      notes: order.notes || '',
      estimatedTime: order.orderType === 'DELIVERY' ? 40 : 20,
      isFromWhatsApp: order.isFromWhatsApp,
      customer: {
        id: order.customer.id,
        firstName: order.customer.firstName || '',
        lastName: order.customer.lastName || '',
        whatsappPhoneNumber: order.customer.whatsappPhoneNumber,
        email: order.customer.email || null,
        totalOrders: order.customer.totalOrders,
        totalSpent: order.customer.totalSpent.toNumber(),
        isActive: order.customer.isActive,
        isBanned: order.customer.isBanned
      },
      orderItems: order.orderItems.map(item => ({
        id: item.id,
        orderId: order.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        price: item.finalPrice,
        notes: item.preparationNotes || '',
        isPizzaHalf: false,
        pizzaHalfPosition: null,
        product: {
          id: item.product.id,
          name: item.product.name
        },
        variant: item.productVariant ? {
          id: item.productVariant.id,
          name: item.productVariant.name
        } : null,
        selectedModifiers: item.productModifiers.map(mod => ({
          id: mod.id,
          name: mod.name,
          price: mod.price || 0
        }))
      })),
      deliveryInfo: order.deliveryInfo ? {
        id: order.deliveryInfo.id,
        address: {
          id: order.deliveryInfo.id,
          name: order.deliveryInfo.recipientName || '',
          street: order.deliveryInfo.street || '',
          number: order.deliveryInfo.number || '',
          interiorNumber: order.deliveryInfo.interiorNumber || null,
          neighborhood: order.deliveryInfo.neighborhood || '',
          city: order.deliveryInfo.city || '',
          state: order.deliveryInfo.state || '',
          zipCode: order.deliveryInfo.zipCode || '',
          country: order.deliveryInfo.country || 'México',
          deliveryInstructions: order.deliveryInfo.deliveryInstructions || '',
          latitude: order.deliveryInfo.latitude?.toNumber() || null,
          longitude: order.deliveryInfo.longitude?.toNumber() || null,
          isDefault: true
        },
        deliveryPersonName: null,
        estimatedDeliveryTime: order.estimatedDeliveryTime?.toISOString() || null
      } : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    }));
  }

  /**
   * Fetch pending customers with full data
   */
  private static async fetchPendingCustomers(customerIds: string[]): Promise<any[]> {
    if (customerIds.length === 0) {
      return [];
    }
    
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        deletedAt: null
      },
      include: {
        addresses: {
          where: { deletedAt: null }
        }
      }
    });
    
    // Transform to expected format
    return customers.map(customer => ({
      id: customer.id,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      stripeCustomerId: customer.stripeCustomerId,
      email: customer.email || null,
      birthDate: customer.birthDate?.toISOString().split('T')[0] || null,
      fullChatHistory: customer.fullChatHistory || [],
      relevantChatHistory: customer.relevantChatHistory || [],
      lastInteraction: customer.lastInteraction?.toISOString() || null,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent.toNumber(),
      isActive: customer.isActive,
      isBanned: customer.isBanned,
      bannedAt: customer.bannedAt?.toISOString() || null,
      banReason: customer.banReason || null,
      lastSyncedAt: new Date().toISOString(),
      addresses: customer.addresses.map(addr => ({
        id: addr.id,
        customerId: customer.id,
        name: addr.name,
        street: addr.street,
        number: addr.number,
        interiorNumber: addr.interiorNumber || null,
        neighborhood: addr.neighborhood || '',
        city: addr.city || '',
        state: addr.state || '',
        zipCode: addr.zipCode || '',
        country: addr.country || 'México',
        deliveryInstructions: addr.deliveryInstructions || '',
        latitude: addr.latitude?.toNumber() || null,
        longitude: addr.longitude?.toNumber() || null,
        isDefault: addr.isDefault,
        createdAt: addr.createdAt.toISOString(),
        updatedAt: addr.updatedAt.toISOString(),
        deletedAt: addr.deletedAt?.toISOString() || null
      })),
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      deletedAt: customer.deletedAt?.toISOString() || null
    }));
  }


  /**
   * Process and save restaurant data received from local system
   */
  static async processRestaurantData(data: LocalSystemResponse): Promise<void> {
    logger.info('Processing restaurant data', {
      hasMenu: !!data.menu,
      hasConfig: !!data.config,
      menuCategoriesCount: data.menu?.categories?.length || 0,
      configHasRestaurantConfig: !!data.config?.restaurantConfig,
      configHasBusinessHours: !!data.config?.businessHours,
      businessHoursCount: data.config?.businessHours?.length || 0
    });
    
    await prisma.$transaction(async (tx) => {
      // Process menu data
      if (data.menu?.categories) {
        logger.info('Processing menu data with categories:', data.menu.categories.length);
        await this.processMenuData(data.menu.categories, tx);
      }

      // Process configuration data
      if (data.config) {
        logger.info('Processing configuration data');
        await this.processConfigData(data.config, tx);
      }
    });
  }

  /**
   * Process and save menu data (categories, subcategories, products)
   */
  private static async processMenuData(categories: any[], tx: any): Promise<void> {
    for (const categoryData of categories) {
      // Upsert category
      const category = await tx.category.upsert({
        where: { id: categoryData.id },
        create: {
          id: categoryData.id,
          name: categoryData.name,
          description: categoryData.description,
          isActive: categoryData.isActive !== false,
          sortOrder: categoryData.sortOrder || 0,
          photoId: categoryData.photoId,
          createdAt: categoryData.createdAt ? new Date(categoryData.createdAt) : new Date(),
          updatedAt: categoryData.updatedAt ? new Date(categoryData.updatedAt) : new Date()
        },
        update: {
          name: categoryData.name,
          description: categoryData.description,
          isActive: categoryData.isActive !== false,
          sortOrder: categoryData.sortOrder || 0,
          photoId: categoryData.photoId,
          updatedAt: new Date(),
          deletedAt: categoryData.deletedAt ? new Date(categoryData.deletedAt) : null
        }
      });
      
      // Process subcategories
      if (categoryData.subcategories && Array.isArray(categoryData.subcategories)) {
        for (const subData of categoryData.subcategories) {
          const subcategory = await tx.subcategory.upsert({
            where: { id: subData.id },
            create: {
              id: subData.id,
              categoryId: category.id,
              name: subData.name,
              description: subData.description,
              isActive: subData.isActive !== false,
              sortOrder: subData.sortOrder || 0,
              photoId: subData.photoId,
              createdAt: subData.createdAt ? new Date(subData.createdAt) : new Date(),
              updatedAt: subData.updatedAt ? new Date(subData.updatedAt) : new Date()
            },
            update: {
              name: subData.name,
              description: subData.description,
              isActive: subData.isActive !== false,
              sortOrder: subData.sortOrder || 0,
              photoId: subData.photoId,
              updatedAt: new Date(),
              deletedAt: subData.deletedAt ? new Date(subData.deletedAt) : null
            }
          });
          
          // Process products
          if (subData.products && Array.isArray(subData.products)) {
            for (const productData of subData.products) {
              // Upsert product
              const product = await tx.product.upsert({
                where: { id: productData.id },
                create: {
                  id: productData.id,
                  name: productData.name,
                  description: productData.description,
                  price: productData.price ? parseFloat(productData.price.toString()) : null,
                  hasVariants: productData.hasVariants || false,
                  isActive: productData.isActive !== false,
                  isPizza: productData.isPizza || false,
                  sortOrder: productData.sortOrder || 0,
                  subcategoryId: productData.subcategoryId || subcategory.id,
                  photoId: productData.photoId,
                  estimatedPrepTime: productData.estimatedPrepTime || 0,
                  preparationScreenId: productData.preparationScreenId,
                  createdAt: productData.createdAt ? new Date(productData.createdAt) : new Date(),
                  updatedAt: productData.updatedAt ? new Date(productData.updatedAt) : new Date()
                },
                update: {
                  name: productData.name,
                  description: productData.description,
                  price: productData.price ? parseFloat(productData.price.toString()) : null,
                  hasVariants: productData.hasVariants || false,
                  isActive: productData.isActive !== false,
                  isPizza: productData.isPizza || false,
                  sortOrder: productData.sortOrder || 0,
                  photoId: productData.photoId,
                  estimatedPrepTime: productData.estimatedPrepTime || 0,
                  preparationScreenId: productData.preparationScreenId,
                  updatedAt: new Date(),
                  deletedAt: productData.deletedAt ? new Date(productData.deletedAt) : null
                }
              });
              
              // Process variants
              if (productData.variants && Array.isArray(productData.variants)) {
                for (const variantData of productData.variants) {
                  await tx.productVariant.upsert({
                    where: { id: variantData.id },
                    create: {
                      id: variantData.id,
                      productId: product.id,
                      name: variantData.name,
                      price: variantData.price != null ? parseFloat(variantData.price.toString()) : 0,
                      isActive: variantData.isActive !== false,
                      sortOrder: variantData.sortOrder || 0,
                      createdAt: variantData.createdAt ? new Date(variantData.createdAt) : new Date(),
                      updatedAt: variantData.updatedAt ? new Date(variantData.updatedAt) : new Date()
                    },
                    update: {
                      name: variantData.name,
                      price: variantData.price != null ? parseFloat(variantData.price.toString()) : 0,
                      isActive: variantData.isActive !== false,
                      sortOrder: variantData.sortOrder || 0,
                      updatedAt: new Date(),
                      deletedAt: variantData.deletedAt ? new Date(variantData.deletedAt) : null
                    }
                  });
                }
              }
              
              // Process modifier groups
              if (productData.modifierGroups && Array.isArray(productData.modifierGroups)) {
                for (const groupData of productData.modifierGroups) {
                  const modifierGroup = await tx.modifierGroup.upsert({
                    where: { id: groupData.id },
                    create: {
                      id: groupData.id,
                      name: groupData.name,
                      description: groupData.description,
                      minSelections: groupData.minSelections || 0,
                      maxSelections: groupData.maxSelections || 1,
                      isRequired: groupData.isRequired || false,
                      allowMultipleSelections: groupData.allowMultipleSelections || false,
                      isActive: groupData.isActive !== false,
                      sortOrder: groupData.sortOrder || 0,
                      createdAt: groupData.createdAt ? new Date(groupData.createdAt) : new Date(),
                      updatedAt: groupData.updatedAt ? new Date(groupData.updatedAt) : new Date()
                    },
                    update: {
                      name: groupData.name,
                      description: groupData.description,
                      minSelections: groupData.minSelections || 0,
                      maxSelections: groupData.maxSelections || 1,
                      isRequired: groupData.isRequired || false,
                      allowMultipleSelections: groupData.allowMultipleSelections || false,
                      isActive: groupData.isActive !== false,
                      sortOrder: groupData.sortOrder || 0,
                      updatedAt: new Date(),
                      deletedAt: groupData.deletedAt ? new Date(groupData.deletedAt) : null
                    }
                  });
                  
                  // Connect to product
                  await tx.product.update({
                    where: { id: product.id },
                    data: {
                      modifierGroups: {
                        disconnect: { id: modifierGroup.id },
                        connect: { id: modifierGroup.id }
                      }
                    }
                  });
                  
                  // Process modifiers
                  if (groupData.productModifiers && Array.isArray(groupData.productModifiers)) {
                    for (const modifierData of groupData.productModifiers) {
                      await tx.productModifier.upsert({
                        where: { id: modifierData.id },
                        create: {
                          id: modifierData.id,
                          modifierGroupId: modifierGroup.id,
                          name: modifierData.name,
                          description: modifierData.description,
                          price: modifierData.price ? parseFloat(modifierData.price.toString()) : 0,
                          sortOrder: modifierData.sortOrder || 0,
                          isDefault: modifierData.isDefault || false,
                          isActive: modifierData.isActive !== false,
                          createdAt: modifierData.createdAt ? new Date(modifierData.createdAt) : new Date(),
                          updatedAt: modifierData.updatedAt ? new Date(modifierData.updatedAt) : new Date()
                        },
                        update: {
                          name: modifierData.name,
                          description: modifierData.description,
                          price: modifierData.price ? parseFloat(modifierData.price.toString()) : 0,
                          sortOrder: modifierData.sortOrder || 0,
                          isDefault: modifierData.isDefault || false,
                          isActive: modifierData.isActive !== false,
                          updatedAt: new Date(),
                          deletedAt: modifierData.deletedAt ? new Date(modifierData.deletedAt) : null
                        }
                      });
                    }
                  }
                }
              }
              
              // Process pizza customizations
              if (productData.pizzaCustomizations && Array.isArray(productData.pizzaCustomizations)) {
                for (const customData of productData.pizzaCustomizations) {
                  await tx.pizzaCustomization.upsert({
                    where: { id: customData.id },
                    create: {
                      id: customData.id,
                      name: customData.name,
                      type: customData.type || 'INGREDIENT',
                      ingredients: customData.ingredients,
                      toppingValue: customData.toppingValue || 1,
                      isActive: customData.isActive !== false,
                      sortOrder: customData.sortOrder || 0
                    },
                    update: {
                      name: customData.name,
                      type: customData.type || 'INGREDIENT',
                      ingredients: customData.ingredients,
                      toppingValue: customData.toppingValue || 1,
                      isActive: customData.isActive !== false,
                      sortOrder: customData.sortOrder || 0
                    }
                  });
                  
                  // Connect to product
                  await tx.product.update({
                    where: { id: product.id },
                    data: {
                      pizzaCustomizations: {
                        disconnect: { id: customData.id },
                        connect: { id: customData.id }
                      }
                    }
                  });
                }
              }
              
              // Process pizza configuration
              if (productData.pizzaConfiguration) {
                await tx.pizzaConfiguration.upsert({
                  where: { productId: product.id },
                  create: {
                    productId: product.id,
                    includedToppings: productData.pizzaConfiguration?.includedToppings || 4,
                    extraToppingCost: productData.pizzaConfiguration?.extraToppingCost || 20
                  },
                  update: {
                    includedToppings: productData.pizzaConfiguration?.includedToppings || 4,
                    extraToppingCost: productData.pizzaConfiguration?.extraToppingCost || 20
                  }
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Process and save configuration data
   */
  private static async processConfigData(configData: any, tx: any): Promise<void> {
    const { restaurantConfig, businessHours } = configData;
    
    logger.info('Processing config data', {
      hasRestaurantConfig: !!restaurantConfig,
      hasBusinessHours: !!businessHours,
      businessHoursCount: businessHours?.length || 0
    });

    // Upsert restaurant config
    await tx.restaurantConfig.upsert({
      where: { id: 1 }, // We use a fixed ID since we only have one config
      create: {
        id: 1,
        restaurantName: restaurantConfig.restaurantName,
        phoneMain: restaurantConfig.phoneMain,
        phoneSecondary: restaurantConfig.phoneSecondary,
        address: restaurantConfig.address,
        city: restaurantConfig.city,
        state: restaurantConfig.state,
        postalCode: restaurantConfig.postalCode,
        country: restaurantConfig.country || 'México',
        acceptingOrders: restaurantConfig.acceptingOrders !== false,
        estimatedPickupTime: restaurantConfig.estimatedPickupTime || 20,
        estimatedDeliveryTime: restaurantConfig.estimatedDeliveryTime || 40,
        openingGracePeriod: restaurantConfig.openingGracePeriod || 30,
        closingGracePeriod: restaurantConfig.closingGracePeriod || 30,
        timeZone: restaurantConfig.timeZone || 'America/Mexico_City',
        deliveryCoverageArea: restaurantConfig.deliveryCoverageArea || []
      },
      update: {
        restaurantName: restaurantConfig.restaurantName,
        phoneMain: restaurantConfig.phoneMain,
        phoneSecondary: restaurantConfig.phoneSecondary,
        address: restaurantConfig.address,
        city: restaurantConfig.city,
        state: restaurantConfig.state,
        postalCode: restaurantConfig.postalCode,
        country: restaurantConfig.country || 'México',
        acceptingOrders: restaurantConfig.acceptingOrders !== false,
        estimatedPickupTime: restaurantConfig.estimatedPickupTime || 20,
        estimatedDeliveryTime: restaurantConfig.estimatedDeliveryTime || 40,
        openingGracePeriod: restaurantConfig.openingGracePeriod || 30,
        closingGracePeriod: restaurantConfig.closingGracePeriod || 30,
        timeZone: restaurantConfig.timeZone || 'America/Mexico_City',
        deliveryCoverageArea: restaurantConfig.deliveryCoverageArea || []
      }
    });
    
    // Update business hours
    if (businessHours && Array.isArray(businessHours)) {
      for (const hoursData of businessHours) {
        // Format time to HH:mm if it includes seconds
        const formatTime = (time: string | null) => {
          if (!time) return null;
          // Remove seconds if present
          return time.substring(0, 5);
        };
        
        await tx.businessHours.upsert({
          where: {
            restaurantConfigId_dayOfWeek: {
              restaurantConfigId: 1,
              dayOfWeek: hoursData.dayOfWeek
            }
          },
          create: {
            restaurantConfigId: 1,
            dayOfWeek: hoursData.dayOfWeek,
            openingTime: formatTime(hoursData.openingTime),
            closingTime: formatTime(hoursData.closingTime),
            isClosed: hoursData.isClosed || false
          },
          update: {
            openingTime: formatTime(hoursData.openingTime),
            closingTime: formatTime(hoursData.closingTime),
            isClosed: hoursData.isClosed || false
          }
        });
      }
    }
    
    // Force reload of configuration cache
    const { ConfigService } = await import('../../services/config/ConfigService');
    await ConfigService.reloadConfig();
  }

  /**
   * Confirm synced items (orders and customers)
   * Marks them as no longer pending synchronization
   */
  static async confirmSyncedItems(
    confirmedOrders: Array<{ orderId: string; dailyNumber: number }>,
    customerIds: string[]
  ): Promise<void> {
    logger.info('UnifiedSync: Confirming synced items', {
      orderCount: confirmedOrders.length,
      customerCount: customerIds.length
    });

    const entities: Array<{ entityType: 'Order' | 'Customer'; entityId: string }> = [];

    // Update orders with daily numbers and add to entities list
    for (const order of confirmedOrders) {
      await prisma.order.update({
        where: { id: order.orderId },
        data: { dailyNumber: order.dailyNumber }
      });
      entities.push({ entityType: 'Order', entityId: order.orderId });
    }

    // Add customers to entities list
    for (const customerId of customerIds) {
      entities.push({ entityType: 'Customer', entityId: customerId });
    }

    // Mark all entities as synced
    if (entities.length > 0) {
      await SyncMetadataService.markAsSynced(entities);
    }
  }
}