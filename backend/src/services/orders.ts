import { prisma } from '../server';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import logger from '../utils/logger';

export async function createOrderFromPreOrder(preOrderId: number) {
  try {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        deliveryInfo: true
      }
    });

    if (!preOrder) {
      throw new Error('PreOrder not found');
    }

    // Get next daily order number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastOrder = await prisma.order.findFirst({
      where: {
        createdAt: { gte: today }
      },
      orderBy: { dailyOrderNumber: 'desc' }
    });

    const dailyOrderNumber = (lastOrder?.dailyOrderNumber || 0) + 1;

    // Calculate total cost
    let totalCost = 0;
    const orderItems = preOrder.orderItems as any[];
    
    for (const item of orderItems) {
      // This would need the full calculation logic from preOrder service
      // For now, using the pre-calculated value if available
      totalCost += item.precio_total_orderItem || 0;
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        dailyOrderNumber,
        orderType: preOrder.orderType,
        status: 'created',
        totalCost,
        customerId: preOrder.customerId,
        scheduledDeliveryTime: preOrder.scheduledDeliveryTime,
        messageId: preOrder.messageId,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderItems: {
          create: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.precio_total_orderItem / item.quantity,
            productVariantId: item.productVariant?.productVariantId,
            comments: item.comments,
            createdAt: new Date(),
            updatedAt: new Date(),
            selectedModifiers: {
              create: item.selectedModifiers?.map((mod: any) => ({
                modifierId: mod.modifierId
              })) || []
            },
            selectedPizzaIngredients: {
              create: item.selectedPizzaIngredients?.map((ing: any) => ({
                pizzaIngredientId: ing.pizzaIngredientId,
                half: ing.half,
                action: ing.action
              })) || []
            }
          }))
        }
      },
      include: {
        orderItems: {
          include: {
            selectedModifiers: true,
            selectedPizzaIngredients: true
          }
        }
      }
    });

    // Update delivery info to link to order
    if (preOrder.deliveryInfo && preOrder.deliveryInfo.length > 0) {
      await prisma.orderDeliveryInfo.update({
        where: { id: preOrder.deliveryInfo[0].id },
        data: { 
          orderId: order.id,
          preOrderId: null
        }
      });
    }

    // Delete preOrder
    await prisma.preOrder.delete({
      where: { id: preOrderId }
    });

    return order;
  } catch (error) {
    logger.error('Error creating order from preOrder:', error);
    throw error;
  }
}

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        finishedAt: status === 'finished' ? new Date() : undefined
      }
    });
    
    return order;
  } catch (error) {
    logger.error('Error updating order status:', error);
    throw error;
  }
}

export async function updatePaymentStatus(orderId: number, paymentStatus: PaymentStatus) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus }
    });
    
    return order;
  } catch (error) {
    logger.error('Error updating payment status:', error);
    throw error;
  }
}

export async function getOrderById(orderId: number) {
  return await prisma.order.findUnique({
    where: { id: orderId },
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

export async function getOrdersByCustomer(customerId: string) {
  return await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      orderItems: true,
      deliveryInfo: true
    }
  });
}

export async function cancelOrder(orderId: number) {
  return await updateOrderStatus(orderId, 'canceled');
}