import { prisma } from '../../lib/prisma';
import logger from "../../common/utils/logger";
import { SchedulingService } from "./services/SchedulingService";
import { ProductCalculationService } from "./services/ProductCalculationService";
import { DeliveryInfoService } from "./services/DeliveryInfoService";
import { RestaurantService } from "../restaurant/RestaurantService";
import { OrderType } from "@prisma/client";
import { ValidationError, ErrorCode } from "../../common/services/errors";
import { BaseOrderItem, DeliveryInfoInput } from "../../common/types";

export class PreOrderService {
  /**
   * Create a preorder with selected products
   */
  async createPreOrder(orderData: {
    orderItems: BaseOrderItem[];
    whatsappPhoneNumber: string;
    orderType: OrderType;
    scheduledAt?: string | Date;
    deliveryInfo?: DeliveryInfoInput;
  }) {
    const { orderItems, whatsappPhoneNumber, orderType, scheduledAt, deliveryInfo: inputDeliveryInfo } = orderData;

    logger.info(`Starting createPreOrder for ${whatsappPhoneNumber}`, {
      orderType,
      itemCount: orderItems.length,
      scheduledAt,
      items: JSON.stringify(orderItems)
    });

    try {
      // Validar que haya al menos un producto
      if (!orderItems || orderItems.length === 0) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'No se puede crear una orden sin productos',
          {
            metadata: {
              validationFailure: 'EMPTY_ORDER',
              message: 'Debes agregar al menos un producto a tu pedido'
            }
          }
        );
      }
      
      // Get restaurant config
      const config = await RestaurantService.getConfig();
      
      // Calculate estimated time based on order type
      const estimatedDeliveryTime = orderType === OrderType.DELIVERY 
        ? config.estimatedDeliveryTime 
        : config.estimatedPickupTime;

      // Validate scheduled time if provided
      const validatedScheduledTime = await SchedulingService.validateScheduledTime(
        scheduledAt,
        orderType
      );

      // Get customerId from whatsapp phone number for delivery info
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });
      
      // Get or create delivery info
      let deliveryInfoId = null;
      if (customer && (orderType === OrderType.DELIVERY || orderType === OrderType.TAKE_AWAY)) {
        const deliveryInfo = await DeliveryInfoService.getOrCreateDeliveryInfo(
          orderType,  // Pass the enum directly
          customer.id,
          inputDeliveryInfo,
          customer
        );
        deliveryInfoId = deliveryInfo.id;
      }

      // Calculate items and totals
      const { items: calculatedItems, subtotal, total } = await ProductCalculationService.calculateOrderItems(
        orderItems
      );

      // Create pre-order data
      const preOrderData: any = {
        whatsappPhoneNumber,
        orderType,
        estimatedDeliveryTime,
      };
      
      // Only add scheduledAt if it exists and is valid
      if (validatedScheduledTime) {
        preOrderData.scheduledAt = validatedScheduledTime;
      }
      
      logger.info('Creating pre-order with data:', {
        whatsappPhoneNumber: preOrderData.whatsappPhoneNumber,
        orderType: preOrderData.orderType,
        scheduledAt: preOrderData.scheduledAt,
        itemCount: calculatedItems.length,
        subtotal,
        total
      });
      
      // Create pre-order with related order items and calculated totals
      const preOrder = await prisma.preOrder.create({
        data: {
          ...preOrderData,
          subtotal,
          total,
          ...(deliveryInfoId ? { deliveryInfo: { connect: { id: deliveryInfoId } } } : {}),
          orderItems: {
            create: calculatedItems.map(item => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              basePrice: item.basePrice,
              finalPrice: item.totalPrice,
              productModifiers: item.selectedModifiers && item.selectedModifiers.length > 0 ? {
                connect: item.selectedModifiers.map(modId => ({ id: modId }))
              } : undefined,
              selectedPizzaCustomizations: item.selectedPizzaCustomizations && item.selectedPizzaCustomizations.length > 0 ? {
                create: item.selectedPizzaCustomizations.map(customization => ({
                  pizzaCustomizationId: customization.pizzaCustomizationId,
                  half: customization.half,
                  action: customization.action
                }))
              } : undefined
            }))
          }
        },
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

      logger.info(`Created pre-order ${preOrder.id} for phone ${whatsappPhoneNumber}`, {
        preOrderId: preOrder.id,
        createdAt: preOrder.createdAt
      });

      // Delivery info is now attached to the preOrder
      const deliveryInfo = preOrder.deliveryInfo;

      // Format order items from the created preOrder
      const formattedItems = preOrder.orderItems.map(item => ({
        ...item,
        productName: item.product.name,
        variantName: item.productVariant?.name,
        modifierNames: item.productModifiers.map(m => m.name),
        pizzaCustomizationDetails: item.selectedPizzaCustomizations.map(sc => ({
          pizzaCustomizationId: sc.pizzaCustomizationId,
          name: sc.pizzaCustomization.name,
          type: sc.pizzaCustomization.type,
          half: sc.half,
          action: sc.action
        })),
        quantity: 1, // Quantity is always 1 per item in our current model
        totalPrice: item.finalPrice
      }));

      return {
        preOrderId: preOrder.id,
        orderType,
        items: formattedItems,
        subtotal: preOrder.subtotal,
        total: preOrder.total,
        deliveryInfo,
        scheduledAt: validatedScheduledTime,
        estimatedDeliveryTime: estimatedDeliveryTime,
      };
    } catch (error) {
      logger.error("Error in createPreOrder:", error);
      throw error;
    }
  }


}