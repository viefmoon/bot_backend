import { prisma } from '../server';
import { CreateOrderDto } from './dto/create-order.dto';
import logger from '../common/utils/logger';
import { NotFoundError, ErrorCode } from '../common/services/errors';

export class OrderService {
  async create(createOrderDto: CreateOrderDto) {
    try {
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
          dailyOrderNumber: 'desc'
        }
      });
      
      const dailyOrderNumber = lastOrder ? lastOrder.dailyOrderNumber + 1 : 1;
      
      // Get restaurant config for estimated times
      const config = await prisma.restaurantConfig.findFirst();
      const estimatedTime = createOrderDto.orderType === 'delivery' 
        ? (config?.estimatedDeliveryTime || 40)
        : (config?.estimatedPickupTime || 20);
      
      // Initialize total cost - will be calculated after creating items
      let totalCost = 0;
      
      // Use Prisma transaction for atomic operations
      const order = await prisma.$transaction(async (tx) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            orderType: createOrderDto.orderType as "delivery" | "pickup",
            customerId: createOrderDto.customerId,
            scheduledDeliveryTime: createOrderDto.scheduledDeliveryTime ? new Date(createOrderDto.scheduledDeliveryTime) : null,
            status: 'created',
            dailyOrderNumber,
            totalCost,
            estimatedTime,
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
              
              const orderItem = await tx.orderItem.create({
                data: {
                  orderId: newOrder.id,
                  productId: item.productId,
                  productVariantId: item.productVariantId,
                  quantity: item.quantity,
                  comments: item.comments,
                  price: itemPrice,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
              
              // Create selected modifiers if provided and add their prices
              if (item.selectedModifiers && item.selectedModifiers.length > 0) {
                const modifiers = await Promise.all(
                  item.selectedModifiers.map(async (selectedModifier) => {
                    const modifier = await tx.modifier.findUnique({
                      where: { id: selectedModifier.modifierId }
                    });
                    
                    if (modifier) {
                      itemPrice += modifier.price;
                    }
                    
                    return tx.selectedModifier.create({
                      data: {
                        orderItemId: orderItem.id,
                        modifierId: selectedModifier.modifierId
                      }
                    });
                  })
                );
              }
              
              // Create selected pizza ingredients if provided
              if (item.selectedPizzaIngredients && item.selectedPizzaIngredients.length > 0) {
                await Promise.all(
                  item.selectedPizzaIngredients.map(ingredient =>
                    tx.selectedPizzaIngredient.create({
                      data: {
                        orderItemId: orderItem.id,
                        pizzaIngredientId: ingredient.pizzaIngredientId,
                        half: ingredient.half as any,
                        action: ingredient.action as any
                      }
                    })
                  )
                );
              }
              
              // Calculate total price for this item (base price + modifiers) * quantity
              const itemTotal = itemPrice * item.quantity;
              totalCost += itemTotal;
              
              // Update order item with final price
              const updatedOrderItem = await tx.orderItem.update({
                where: { id: orderItem.id },
                data: { price: itemPrice }
              });
              
              return updatedOrderItem;
            })
          );
        }
        
        // Create delivery info if provided
        if (createOrderDto.orderDeliveryInfo) {
          await tx.orderDeliveryInfo.create({
            data: {
              ...createOrderDto.orderDeliveryInfo,
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

  async findOne(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            selectedModifiers: {
              include: {
                modifier: true
              }
            },
            selectedPizzaIngredients: {
              include: {
                pizzaIngredient: true
              }
            }
          }
        },
        deliveryInfo: true
      }
    });
  }

  async update(id: number, updateData: any) {
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

  async cancel(id: number) {
    return this.update(id, { status: 'canceled' });
  }
}