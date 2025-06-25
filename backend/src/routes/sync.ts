import { Router, Request, Response } from 'express';
import { asyncHandler } from '../common/middlewares/errorHandler';
import { syncAuthMiddleware } from '../common/middlewares/syncAuth.middleware';
import { SyncService } from '../services/sync/SyncService';
import { SyncMetadataService } from '../services/sync/SyncMetadataService';
import { prisma } from '../server';
import logger from '../common/utils/logger';

const router = Router();

// All sync routes require authentication
router.use(syncAuthMiddleware);

/**
 * Helper function to validate custom ID format
 */
function isValidCustomId(id: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}-\\d+$`);
  return pattern.test(id);
}

/**
 * POST /api/sync/menu
 * Receive complete menu from local with exact structure
 */
router.post('/menu', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Sync: Menu push received');
  
  const { categories } = req.body;
  
  if (!categories || !Array.isArray(categories)) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request: categories array required',
        details: {
          field: 'categories',
          expected: 'array of categories'
        }
      }
    });
  }
  
  try {
    // Transaction to update menu
    await prisma.$transaction(async (tx) => {
      // Process each category
      for (const categoryData of categories) {
        
        // Validate category ID format
        if (!isValidCustomId(categoryData.id, 'CAT')) {
          throw new Error(`Invalid category ID format: ${categoryData.id}`);
        }
        
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
            
            if (!isValidCustomId(subData.id, 'SUB')) {
              throw new Error(`Invalid subcategory ID format: ${subData.id}`);
            }
            
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
            
            // Process products within subcategories
            if (subData.products && Array.isArray(subData.products)) {
              for (const productData of subData.products) {
                
                if (!isValidCustomId(productData.id, 'PR')) {
                  throw new Error(`Invalid product ID format: ${productData.id}`);
                }
                
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
                    if (!isValidCustomId(variantData.id, 'PVA')) {
                      throw new Error(`Invalid variant ID format: ${variantData.id}`);
                    }
                    
                    await tx.productVariant.upsert({
                      where: { id: variantData.id },
                      create: {
                        id: variantData.id,
                        productId: product.id,
                        name: variantData.name,
                        price: parseFloat(variantData.price.toString()),
                        isActive: variantData.isActive !== false,
                        sortOrder: variantData.sortOrder || 0,
                        createdAt: variantData.createdAt ? new Date(variantData.createdAt) : new Date(),
                        updatedAt: variantData.updatedAt ? new Date(variantData.updatedAt) : new Date()
                      },
                      update: {
                        name: variantData.name,
                        price: parseFloat(variantData.price.toString()),
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
                    if (!isValidCustomId(groupData.id, 'MODG')) {
                      throw new Error(`Invalid modifier group ID format: ${groupData.id}`);
                    }
                    
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
                          connect: { id: modifierGroup.id }
                        }
                      }
                    });
                    
                    // Process modifiers
                    if (groupData.productModifiers && Array.isArray(groupData.productModifiers)) {
                      for (const modifierData of groupData.productModifiers) {
                        if (!isValidCustomId(modifierData.id, 'MOD')) {
                          throw new Error(`Invalid modifier ID format: ${modifierData.id}`);
                        }
                        
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
                        ingredients: customData.ingredients || customData.description,
                        toppingValue: customData.toppingValue || 1,
                        isActive: customData.isActive !== false,
                        sortOrder: customData.sortOrder || 0
                      },
                      update: {
                        name: customData.name,
                        type: customData.type || 'INGREDIENT',
                        ingredients: customData.ingredients || customData.description,
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
        
        // Note: Products are processed within subcategories, not directly in categories
      }
    });
    
    const totalProducts = await prisma.product.count();
    const totalSubcategories = await prisma.subcategory.count();
    
    logger.info(`Menu sync completed: ${categories.length} categories, ${totalSubcategories} subcategories, ${totalProducts} products`);
    
    await SyncService.logSync('MENU_PUSH', categories.length, 'SUCCESS');
    
    res.status(200).json({
      success: true,
      message: 'Menu synchronized successfully'
    });
  } catch (error: any) {
    logger.error('Menu sync error:', error);
    await SyncService.logSync('MENU_PUSH', 0, 'FAILED', error.message);
    
    res.status(400).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * POST /api/sync/config
 * Receive restaurant configuration from local with exact structure
 */
router.post('/config', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Sync: Restaurant config push received');
  
  const { config } = req.body;
  
  if (!config) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request: config object required',
        details: {
          field: 'config',
          expected: 'configuration object'
        }
      }
    });
  }
  
  try {
    // Validate deliveryCoverageArea is an array
    if (config.deliveryCoverageArea && !Array.isArray(config.deliveryCoverageArea)) {
      throw new Error('deliveryCoverageArea must be an array of coordinates');
    }
    
    // Upsert restaurant config
    const restaurantConfig = await prisma.restaurantConfig.upsert({
      where: { id: 1 }, // We use a fixed ID since we only have one config
      create: {
        id: 1,
        restaurantName: config.restaurantName,
        phoneMain: config.phoneMain,
        phoneSecondary: config.phoneSecondary,
        address: config.address,
        city: config.city,
        state: config.state,
        postalCode: config.postalCode,
        country: config.country || 'México',
        acceptingOrders: config.acceptingOrders !== false,
        estimatedPickupTime: config.estimatedPickupTime || 20,
        estimatedDeliveryTime: config.estimatedDeliveryTime || 40,
        openingGracePeriod: config.openingGracePeriod || 30,
        closingGracePeriod: config.closingGracePeriod || 30,
        timeZone: config.timeZone || 'America/Mexico_City',
        deliveryCoverageArea: config.deliveryCoverageArea || []
      },
      update: {
        restaurantName: config.restaurantName,
        phoneMain: config.phoneMain,
        phoneSecondary: config.phoneSecondary,
        address: config.address,
        city: config.city,
        state: config.state,
        postalCode: config.postalCode,
        country: config.country || 'México',
        acceptingOrders: config.acceptingOrders !== false,
        estimatedPickupTime: config.estimatedPickupTime || 20,
        estimatedDeliveryTime: config.estimatedDeliveryTime || 40,
        openingGracePeriod: config.openingGracePeriod || 30,
        closingGracePeriod: config.closingGracePeriod || 30,
        timeZone: config.timeZone || 'America/Mexico_City',
        deliveryCoverageArea: config.deliveryCoverageArea || []
      }
    });
    
    // Update business hours if provided
    if (config.businessHours && Array.isArray(config.businessHours)) {
      for (const hoursData of config.businessHours) {
        // Format time to HH:mm if it includes seconds
        const formatTime = (time: string | null) => {
          if (time && time.length > 5) {
            return time.substring(0, 5);
          }
          return time;
        };
        
        await prisma.businessHours.upsert({
          where: {
            restaurantConfigId_dayOfWeek: {
              restaurantConfigId: restaurantConfig.id,
              dayOfWeek: hoursData.dayOfWeek
            }
          },
          create: {
            restaurantConfigId: restaurantConfig.id,
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
    const { ConfigService } = await import('../services/config/ConfigService');
    await ConfigService.reloadConfig();
    
    await SyncService.logSync('CONFIG_PUSH', 1, 'SUCCESS');
    
    res.status(200).json({
      success: true,
      message: 'Configuration synchronized successfully'
    });
  } catch (error: any) {
    await SyncService.logSync('CONFIG_PUSH', 0, 'FAILED', error.message);
    
    res.status(400).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * GET /api/sync/orders/pending
 * Get orders that haven't been synced to local with exact structure
 */
router.get('/orders/pending', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Sync: Pending orders requested');
  
  try {
    // Get pending order IDs from sync metadata
    const pendingOrders = await SyncMetadataService.getPendingSync('Order');
    const orderIds = pendingOrders.map(p => p.entityId);
    
    if (orderIds.length === 0) {
      await SyncService.logSync('ORDERS_PULL', 0, 'SUCCESS');
      return res.json({
        data: []
      });
    }
    
    // Get full order data with the expected structure
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
    
    // Transform orders to match expected format exactly
    const transformedOrders = orders.map(order => ({
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
        quantity: 1, // TODO: Add quantity field to OrderItem model
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
          price: mod.price || 0,
          quantity: 1
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
    
    await SyncService.logSync('ORDERS_PULL', transformedOrders.length, 'SUCCESS');
    
    res.json({
      data: transformedOrders
    });
  } catch (error: any) {
    await SyncService.logSync('ORDERS_PULL', 0, 'FAILED', error.message);
    
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * POST /api/sync/orders/confirm
 * Confirm orders have been synced and update dailyNumbers
 */
router.post('/orders/confirm', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Sync: Order confirmation received');
  
  const { orderUpdates } = req.body;
  
  if (!orderUpdates || !Array.isArray(orderUpdates)) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request: orderUpdates array required',
        details: {
          field: 'orderUpdates',
          expected: 'array of order updates'
        }
      }
    });
  }
  
  try {
    // Update orders with dailyNumbers from local system
    const updatePromises = orderUpdates.map(update => 
      prisma.order.update({
        where: { id: update.orderId },
        data: {
          dailyNumber: update.dailyNumber
        }
      })
    );
    
    await Promise.all(updatePromises);
    
    // Mark orders as synced in metadata
    await SyncMetadataService.markAsSynced(
      orderUpdates.map(update => ({
        entityType: 'Order' as const,
        entityId: update.orderId
      }))
    );
    
    await SyncService.logSync('ORDERS_CONFIRM', orderUpdates.length, 'SUCCESS');
    
    res.status(200).json({
      success: true,
      message: `${orderUpdates.length} orders confirmed successfully`
    });
  } catch (error: any) {
    await SyncService.logSync('ORDERS_CONFIRM', 0, 'FAILED', error.message);
    
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * GET /api/sync/customers/changes
 * Get customer changes since last sync with exact structure
 */
router.get('/customers/changes', asyncHandler(async (req: Request, res: Response) => {
  const { since } = req.query;
  
  if (!since) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required query parameter: since',
        details: {
          field: 'since',
          expected: 'ISO date string'
        }
      }
    });
  }
  
  const sinceDate = new Date(since as string);
  
  if (isNaN(sinceDate.getTime())) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid date format for since parameter',
        details: {
          field: 'since',
          value: since,
          expected: 'ISO date string'
        }
      }
    });
  }
  
  logger.info(`Sync: Customer changes requested since ${sinceDate}`);
  
  try {
    // Get customers modified since date
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { updatedAt: { gte: sinceDate } },
          { createdAt: { gte: sinceDate } }
        ],
        deletedAt: null
      },
      include: {
        addresses: {
          where: { deletedAt: null }
        }
      }
    });
    
    // Transform customers to match expected format exactly
    const transformedCustomers = customers.map(customer => ({
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
    
    await SyncService.logSync('CUSTOMERS_PULL', transformedCustomers.length, 'SUCCESS');
    
    res.json({
      data: transformedCustomers
    });
  } catch (error: any) {
    await SyncService.logSync('CUSTOMERS_PULL', 0, 'FAILED', error.message);
    
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * POST /api/sync/customers/bulk
 * Bulk update customers from local with exact structure
 */
router.post('/customers/bulk', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Sync: Customer bulk update received');
  
  const { customers } = req.body;
  
  if (!customers || !Array.isArray(customers)) {
    return res.status(400).json({ 
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request: customers array required',
        details: {
          field: 'customers',
          expected: 'array of customers'
        }
      }
    });
  }
  
  try {
    let updatedCount = 0;
    
    // Process each customer
    for (const customerData of customers) {
      const existing = await prisma.customer.findUnique({
        where: { id: customerData.id }
      });
      
      if (existing) {
        // Update customer
        await prisma.customer.update({
          where: { id: customerData.id },
          data: {
            firstName: customerData.firstName || existing.firstName,
            lastName: customerData.lastName || existing.lastName,
            email: customerData.email,
            totalOrders: customerData.totalOrders || existing.totalOrders,
            totalSpent: customerData.totalSpent || existing.totalSpent,
            lastInteraction: customerData.lastInteraction ? new Date(customerData.lastInteraction) : existing.lastInteraction,
            updatedAt: new Date()
          }
        });
        
        // Update addresses if provided
        if (customerData.addresses && Array.isArray(customerData.addresses)) {
          for (const addr of customerData.addresses) {
            if (addr.id) {
              // Update existing address
              await prisma.address.update({
                where: { id: addr.id },
                data: {
                  name: addr.name,
                  street: addr.street,
                  number: addr.number,
                  interiorNumber: addr.interiorNumber,
                  neighborhood: addr.neighborhood,
                  city: addr.city,
                  state: addr.state,
                  zipCode: addr.zipCode,
                  country: addr.country || 'México',
                  deliveryInstructions: addr.deliveryInstructions,
                  latitude: addr.latitude,
                  longitude: addr.longitude,
                  isDefault: addr.isDefault,
                  updatedAt: new Date()
                }
              });
            }
          }
        }
        
        updatedCount++;
      }
    }
    
    await SyncService.logSync('CUSTOMERS_PUSH', updatedCount, 'SUCCESS');
    
    res.status(200).json({
      success: true,
      message: `${updatedCount} customers updated successfully`
    });
  } catch (error: any) {
    await SyncService.logSync('CUSTOMERS_PUSH', 0, 'FAILED', error.message);
    
    res.status(500).json({
      error: {
        code: 'SYNC_ERROR',
        message: error.message,
        details: {}
      }
    });
  }
}));

/**
 * GET /api/sync/status
 * Get sync status and health check
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const recentLogs = await prisma.syncLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10
  });
  
  res.json({
    success: true,
    status: 'healthy',
    recentLogs,
    timestamp: new Date()
  });
}));

export default router;