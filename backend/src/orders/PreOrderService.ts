import { prisma } from "../server";
import logger from "../common/utils/logger";
import { SchedulingService } from "./services/SchedulingService";
import { ProductCalculationService } from "./services/ProductCalculationService";
import { DeliveryInfoService } from "./services/DeliveryInfoService";
import { RestaurantService } from "../services/restaurant/RestaurantService";
import { NotFoundError, ErrorCode } from "../common/services/errors";

export class PreOrderService {
  /**
   * Create a preorder with selected products
   */
  async selectProducts(orderData: {
    orderItems: any[];
    customerId: string;
    orderType: string;
    scheduledDeliveryTime?: string | Date;
    deliveryInfo?: any;
  }) {
    const { orderItems, customerId, orderType, scheduledDeliveryTime, deliveryInfo } = orderData;

    try {
      // Get restaurant config
      const config = await RestaurantService.getConfig();

      // Validate scheduled time if provided
      const validatedScheduledTime = await SchedulingService.validateScheduledTime(
        scheduledDeliveryTime,
        orderType as 'delivery' | 'pickup'
      );

      // Get or create delivery info
      const orderDeliveryInfo = await DeliveryInfoService.getOrCreateDeliveryInfo(
        orderType as 'delivery' | 'pickup',
        customerId,
        deliveryInfo
      );

      // Calculate items and total cost
      const { items: calculatedItems, totalCost } = await ProductCalculationService.calculateOrderItems(
        orderItems
      );

      // Create pre-order
      const preOrder = await prisma.preOrder.create({
        data: {
          customerId,
          orderType,
          totalCost,
          estimatedTime: orderType === "delivery" 
            ? config.estimatedDeliveryTime 
            : config.estimatedPickupTime,
          scheduledDeliveryTime: validatedScheduledTime,
          deliveryInfoId: orderDeliveryInfo.id,
          messageId: `preorder_${customerId}_${Date.now()}`,
        },
      });

      logger.info(`Created pre-order ${preOrder.id} for customer ${customerId}`);

      // Create selected products
      const selectedProducts = await Promise.all(
        calculatedItems.map(async (item, index) => {
          const orderItem = orderItems[index];
          
          const selectedProduct = await prisma.selectedProduct.create({
            data: {
              preOrderId: preOrder.id,
              productId: item.product?.id,
              productVariantId: item.productVariant?.id,
              quantity: item.quantity,
              comments: item.comments,
            },
          });

          // Create selected modifiers
          if (orderItem.selectedModifiers?.length > 0) {
            await prisma.selectedModifier.createMany({
              data: orderItem.selectedModifiers.map((modifierId: string) => ({
                selectedProductId: selectedProduct.id,
                modifierId,
              })),
            });
          }

          // Create selected pizza ingredients
          if (orderItem.selectedPizzaIngredients?.length > 0) {
            await prisma.selectedPizzaIngredient.createMany({
              data: orderItem.selectedPizzaIngredients.map((ing: any) => ({
                selectedProductId: selectedProduct.id,
                pizzaIngredientId: ing.pizzaIngredientId,
                half: ing.half,
                action: ing.action || "add",
              })),
            });
          }

          return selectedProduct;
        })
      );

      logger.info(`Created ${selectedProducts.length} selected products for pre-order ${preOrder.id}`);

      return {
        preOrderId: preOrder.id,
        selectedProducts: {
          items: calculatedItems,
          totalCost,
          estimatedPickupTime: config.estimatedPickupTime,
          estimatedDeliveryTime: config.estimatedDeliveryTime,
        }
      };
    } catch (error) {
      logger.error("Error in selectProducts:", error);
      throw error;
    }
  }

  /**
   * Update delivery info for a preorder
   */
  async updateDeliveryInfo(preOrderId: number, deliveryInfo: any): Promise<void> {
    await DeliveryInfoService.updatePreOrderDeliveryInfo(preOrderId, deliveryInfo);
  }

  /**
   * Get preorder summary
   */
  async getPreOrderSummary(preOrderId: number): Promise<any> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        selectedProducts: {
          include: {
            product: true,
            productVariant: true,
            selectedModifiers: {
              include: { modifier: true }
            },
            selectedPizzaIngredients: {
              include: { pizzaIngredient: true }
            }
          }
        },
        deliveryInfo: true
      }
    });

    if (!preOrder) {
      throw new NotFoundError(
        ErrorCode.ORDER_NOT_FOUND,
        "PreOrder not found",
        { metadata: { preOrderId } }
      );
    }

    // Format products for display
    const products = preOrder.selectedProducts.map(sp => ({
      productId: sp.productId,
      productVariantId: sp.productVariantId,
      nombre: sp.productVariant?.name || sp.product?.name || "Producto",
      cantidad: sp.quantity,
      precio: sp.productVariant?.price || 0,
      comments: sp.comments,
      modificadores: sp.selectedModifiers.map(sm => ({
        id: sm.modifier.id,
        nombre: sm.modifier.name,
        precio: sm.modifier.price
      })),
      ingredientes_pizza: sp.selectedPizzaIngredients.map(spi => ({
        id: spi.pizzaIngredient.id,
        nombre: spi.pizzaIngredient.name,
        mitad: spi.half,
        action: spi.action
      }))
    }));

    return {
      id: preOrder.id,
      customerId: preOrder.customerId,
      orderType: preOrder.orderType,
      totalCost: preOrder.totalCost,
      estimatedTime: preOrder.estimatedTime,
      scheduledDeliveryTime: preOrder.scheduledDeliveryTime,
      deliveryInfo: preOrder.deliveryInfo,
      products
    };
  }
}