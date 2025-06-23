import { prisma } from '../../server';
import { PizzaHalf, CustomizationAction } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import logger from '../../common/utils/logger';
import { NotFoundError, ErrorCode } from '../../common/services/errors';

export class OrderService {
  async create(createOrderDto: CreateOrderDto) {
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
      
      // Generar el número de orden diario
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastOrder = await prisma.order.findFirst({
        where: {
          createdAt: {
            gte: today
          }
        },
        orderBy: {
          dailyNumber: 'desc'
        }
      });
      
      const dailyNumber = lastOrder ? lastOrder.dailyNumber + 1 : 1;
      
      // Get restaurant config for estimated times
      const config = await prisma.restaurantConfig.findFirst();
      const estimatedTime = createOrderDto.orderType === 'DELIVERY' 
        ? (config?.estimatedDeliveryTime || 40)
        : (config?.estimatedPickupTime || 20);
      
      // Initialize total cost - will be calculated after creating items
      let totalCost = 0;
      
      // Use Prisma transaction for atomic operations
      const order = await prisma.$transaction(async (tx) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            orderType: createOrderDto.orderType as "DINE_IN" | "TAKE_AWAY" | "DELIVERY",
            customerId: customer.id,
            scheduledAt: createOrderDto.scheduledAt ? new Date(createOrderDto.scheduledAt) : null,
            orderStatus: 'PENDING',
            dailyNumber,
            totalCost,
            estimatedTime,
            isFromWhatsApp: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Create order items if provided
        if (createOrderDto.orderItems && createOrderDto.orderItems.length > 0) {
          const orderItemsWithPrices = await Promise.all(
            createOrderDto.orderItems.map(async (item) => {
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
                modifierIds = item.selectedModifiers.map(sm => sm.modifierId);
                
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
              
              // Calculate total price for all items of this type
              const itemTotal = itemPrice * quantity;
              totalCost += itemTotal;
              
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
        
        // Update order with calculated total cost
        const updatedOrder = await tx.order.update({
          where: { id: newOrder.id },
          data: { totalCost }
        });
        
        return updatedOrder;
      });
      
      return order;
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  async findOne(id: string) {
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

  async update(id: string, updateData: any) {
    try {
      const order = await prisma.order.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      return order;
    } catch (error) {
      // If the order doesn't exist, Prisma will throw an error
      return null;
    }
  }

  async cancel(id: string) {
    return this.update(id, { orderStatus: 'CANCELLED' });
  }

}