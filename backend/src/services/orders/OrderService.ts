import { prisma } from '../../server';
import { PizzaHalf, CustomizationAction } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import logger from '../../common/utils/logger';
import { NotFoundError, ErrorCode } from '../../common/services/errors';
import { SyncMetadataService } from '../sync/SyncMetadataService';

export class OrderService {
  static async create(createOrderDto: CreateOrderDto) {
    try {
      // Get customer by WhatsApp phone number
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber: createOrderDto.whatsappPhoneNumber }
      });
      
      if (!customer) {
        throw new NotFoundError(
          ErrorCode.CUSTOMER_NOT_FOUND,
          'Customer not found',
          { whatsappPhoneNumber: createOrderDto.whatsappPhoneNumber }
        );
      }
      
      // Get restaurant config for estimated times
      const config = await prisma.restaurantConfig.findFirst();
      const estimatedMinutes = createOrderDto.orderType === 'DELIVERY' 
        ? (config?.estimatedDeliveryTime || 40)
        : (config?.estimatedPickupTime || 20);
      
      // Calculate estimated delivery time as a DateTime
      const now = new Date();
      const estimatedDeliveryTime = new Date(now.getTime() + estimatedMinutes * 60 * 1000);
      
      // Initialize totals - use provided values if available, otherwise will be calculated
      let subtotal = createOrderDto.subtotal || 0;
      let total = createOrderDto.total || 0;
      const hasProvidedTotals = createOrderDto.subtotal !== undefined && createOrderDto.total !== undefined;
      
      // Use Prisma transaction for atomic operations
      const order = await prisma.$transaction(async (tx) => {
        // Create the order without dailyNumber (will be assigned during sync)
        const newOrder = await tx.order.create({
          data: {
            orderType: createOrderDto.orderType as "DINE_IN" | "TAKE_AWAY" | "DELIVERY",
            customerId: customer.id,
            scheduledAt: createOrderDto.scheduledAt ? new Date(createOrderDto.scheduledAt) : null,
            orderStatus: 'PENDING',
            subtotal,
            total,
            estimatedDeliveryTime,
            isFromWhatsApp: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Create order items if provided
        if (createOrderDto.orderItems && createOrderDto.orderItems.length > 0) {
          const orderItemsWithPrices = await Promise.all(
            createOrderDto.orderItems.map(async (item) => {
              // Validate productId exists
              if (!item.productId) {
                throw new NotFoundError(
                  ErrorCode.MISSING_REQUIRED_FIELD,
                  'Product ID is required for each order item',
                  { metadata: { item } }
                );
              }
              
              // Get product and variant info to calculate price
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                include: { variants: true }
              });
              
              if (!product) {
                throw new NotFoundError(
                  ErrorCode.INVALID_PRODUCT,
                  `Product ${item.productId} not found`,
                  { metadata: { productId: item.productId } }
                );
              }
              
              // Calculate base price
              let itemPrice = 0;
              if (item.productVariantId) {
                const variant = product.variants.find(v => v.id === item.productVariantId);
                if (variant) {
                  itemPrice = variant.price;
                }
              } else if (product.price !== null) {
                itemPrice = product.price;
              }
              
              // First calculate total price including modifiers
              let modifierIds: string[] = [];
              if (item.selectedModifiers && item.selectedModifiers.length > 0) {
                modifierIds = item.selectedModifiers; // Now directly an array of strings
                
                // Get modifier prices
                const modifiers = await tx.productModifier.findMany({
                  where: { id: { in: modifierIds } }
                });
                
                // Add modifier prices to item price
                for (const modifier of modifiers) {
                  itemPrice += modifier.price || 0;
                }
              }
              
              // Crear items individuales según la cantidad
              const quantity = item.quantity || 1;
              const orderItems = [];
              
              for (let i = 0; i < quantity; i++) {
                const orderItem = await tx.orderItem.create({
                  data: {
                    orderId: newOrder.id,
                    productId: item.productId,
                    productVariantId: item.productVariantId,
                    basePrice: itemPrice,
                    finalPrice: itemPrice,
                    productModifiers: modifierIds.length > 0 ? {
                      connect: modifierIds.map(id => ({ id }))
                    } : undefined
                  }
                });
                orderItems.push(orderItem);
              }
              
              // Create selected pizza customizations for each order item if provided
              if (item.selectedPizzaCustomizations && item.selectedPizzaCustomizations.length > 0) {
                for (const orderItem of orderItems) {
                  await Promise.all(
                    item.selectedPizzaCustomizations.map(customization =>
                      tx.selectedPizzaCustomization.create({
                        data: {
                          orderItemId: orderItem.id,
                          pizzaCustomizationId: customization.pizzaCustomizationId,
                          half: customization.half as PizzaHalf,
                          action: customization.action as CustomizationAction
                        }
                      })
                    )
                  );
                }
              }
              
              // Calculate total price for all items of this type only if totals weren't provided
              if (!hasProvidedTotals) {
                const itemTotal = itemPrice * quantity;
                subtotal += itemTotal;
              }
              
              return orderItems;
            })
          );
        }
        
        // Create delivery info if provided
        if (createOrderDto.deliveryInfo) {
          await tx.deliveryInfo.create({
            data: {
              ...createOrderDto.deliveryInfo,
              orderId: newOrder.id,
            }
          });
        }
        
        // Calculate total only if not provided (for now, total = subtotal, but can add taxes, delivery fees, etc. later)
        if (!hasProvidedTotals) {
          total = subtotal;
        }
        
        // Update order with calculated totals
        const updatedOrder = await tx.order.update({
          where: { id: newOrder.id },
          data: { subtotal, total }
        });
        
        // Mark order for sync within the transaction to ensure consistency
        await SyncMetadataService.markForSync('Order', updatedOrder.id, 'REMOTE');
        
        return updatedOrder;
      });
      
      return order;
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  static async findOne(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            productModifiers: true,
            selectedPizzaCustomizations: {
              include: {
                pizzaCustomization: true
              }
            }
          }
        },
        deliveryInfo: true
      }
    });
  }

  static async update(id: string, updateData: any) {
    try {
      const order = await prisma.order.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      return order;
    } catch (error: any) {
      // Handle specific Prisma errors
      if (error.code === 'P2025') {
        throw new NotFoundError(
          ErrorCode.ORDER_NOT_FOUND,
          'Order not found',
          { orderId: id }
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  static async cancel(id: string) {
    return this.update(id, { orderStatus: 'CANCELLED' });
  }

}