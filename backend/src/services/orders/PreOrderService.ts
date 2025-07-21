import { prisma } from '../../lib/prisma';
import logger from "../../common/utils/logger";
import { SchedulingService } from "./services/SchedulingService";
import { ProductCalculationService } from "./services/ProductCalculationService";
import { DeliveryInfoService } from "./services/DeliveryInfoService";
import { RestaurantService } from "../restaurant/RestaurantService";
import { OrderType } from "@prisma/client";
import { ValidationError, ErrorCode } from "../../common/services/errors";
import { BaseOrderItem, DeliveryInfoInput } from "../../common/types";
import { OrderItemValidatorService } from './services/OrderItemValidatorService';

export class PreOrderService {
  /**
   * Create a preorder with selected products
   */
  async createPreOrder(orderData: {
    orderItems: BaseOrderItem[];
    whatsappPhoneNumber: string;
    orderType?: OrderType;  // Now optional
    scheduledAt?: string | Date;
    deliveryInfo?: DeliveryInfoInput;
  }) {
    const { orderItems, whatsappPhoneNumber, scheduledAt, deliveryInfo: inputDeliveryInfo } = orderData;
    let { orderType } = orderData;

    logger.info(`Starting createPreOrder for ${whatsappPhoneNumber}`, {
      orderType,
      itemCount: orderItems.length,
      scheduledAt,
      items: JSON.stringify(orderItems)
    });

    try {
      // Validate all order items before any other operation
      await OrderItemValidatorService.validateOrderItems(orderItems);

      // Get customer to check for addresses (needed for orderType inference)
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });

      // Infer orderType if not provided
      if (!orderType) {
        const addressCount = await prisma.address.count({
          where: {
            customerId: customer?.id,
            deletedAt: null
          }
        });

        // If customer has addresses, default to DELIVERY; otherwise TAKE_AWAY
        orderType = addressCount > 0 ? OrderType.DELIVERY : OrderType.TAKE_AWAY;
        
        logger.info(`Inferred orderType: ${orderType} (addresses: ${addressCount})`);
      }

      // Flatten order items based on quantity
      const flattenedOrderItems: BaseOrderItem[] = orderItems.flatMap(item => {
        // If quantity is not defined or is 1, return the item as is
        if (!item.quantity || item.quantity <= 1) {
          return [{ ...item, quantity: 1 }];
        }
        
        // If quantity is > 1, create an array of cloned items
        const clones: BaseOrderItem[] = [];
        for (let i = 0; i < item.quantity; i++) {
          clones.push({
            ...item,
            quantity: 1 // Each individual record represents a quantity of 1
          });
        }
        return clones;
      });

      logger.info(`Flattened ${orderItems.length} items to ${flattenedOrderItems.length} items based on quantities`)
      
      // Get restaurant config from database
      const config = await prisma.restaurantConfig.findFirst();
      
      if (!config) {
        throw new ValidationError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          'Restaurant configuration not found'
        );
      }
      
      // Calculate estimated time based on order type (will recalculate later if type changes)
      let estimatedDeliveryTime = orderType === OrderType.DELIVERY 
        ? config.estimatedDeliveryTime 
        : config.estimatedPickupTime;

      // Validate scheduled time if provided
      const validatedScheduledTime = await SchedulingService.validateScheduledTime(
        scheduledAt,
        orderType
      );

      // Customer already fetched above for orderType inference
      
      // If delivery order without addresses, convert to TAKE_AWAY
      if (orderType === OrderType.DELIVERY) {
        const addressCount = await prisma.address.count({
          where: {
            customerId: customer?.id,
            deletedAt: null
          }
        });

        if (addressCount === 0) {
          // Customer is trying to order delivery without any registered addresses
          // Convert to TAKE_AWAY instead of throwing error
          logger.info(`Converting DELIVERY order to TAKE_AWAY due to no addresses for customer ${whatsappPhoneNumber}`);
          orderType = OrderType.TAKE_AWAY;
          // Recalculate estimated time for pickup
          estimatedDeliveryTime = config.estimatedPickupTime;
        }
      }
      
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
        flattenedOrderItems
      );

      // Validate minimum order value for delivery
      const minimumValue = (config as any).minimumOrderValueForDelivery ? Number((config as any).minimumOrderValueForDelivery) : 0;
      
      if (orderType === OrderType.DELIVERY && minimumValue > 0 && total < minimumValue) {
        const difference = minimumValue - total;
        const message = `El pedido mínimo para entrega a domicilio es de $${minimumValue.toFixed(2)}. Te faltan $${difference.toFixed(2)} para alcanzarlo. ¿Deseas agregar algo más?`;
        
        throw new ValidationError(
          ErrorCode.MINIMUM_ORDER_VALUE_NOT_MET,
          message,
          {
            minimumValue: minimumValue.toFixed(2),
            currentValue: total.toFixed(2),
            difference: difference.toFixed(2),
            metadata: {
              orderType,
              currentTotal: total,
              minimumRequired: minimumValue,
              missingAmount: difference
            }
          }
        );
      }

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

      // Helper function to create a unique key for grouping identical items
      const getItemGroupingKey = (item: any): string => {
        const parts = [
          item.productId,
          item.productVariantId || 'null',
          // Include sorted modifier IDs
          (item.productModifiers || [])
            .map((mod: any) => mod.id)
            .sort()
            .join(',') || 'no-modifiers',
          // Include sorted pizza customizations
          (item.selectedPizzaCustomizations || [])
            .map((c: any) => `${c.pizzaCustomizationId}-${c.half}-${c.action}`)
            .sort()
            .join(',') || 'no-customizations'
        ];
        return parts.join('|');
      };

      // Group identical items
      const itemGroups = new Map<string, any[]>();
      preOrder.orderItems.forEach(item => {
        const key = getItemGroupingKey(item);
        if (!itemGroups.has(key)) {
          itemGroups.set(key, []);
        }
        itemGroups.get(key)!.push(item);
      });

      // Format grouped items
      const formattedItems = Array.from(itemGroups.values()).map(items => {
        const firstItem = items[0];
        const quantity = items.length;
        const totalPrice = items.reduce((sum, item) => sum + item.finalPrice, 0);
        
        return {
          productId: firstItem.productId,
          productVariantId: firstItem.productVariantId,
          productName: firstItem.product.name,
          variantName: firstItem.productVariant?.name,
          modifierNames: firstItem.productModifiers.map((m: any) => m.name),
          pizzaCustomizationDetails: firstItem.selectedPizzaCustomizations.map((sc: any) => ({
            pizzaCustomizationId: sc.pizzaCustomizationId,
            name: sc.pizzaCustomization.name,
            type: sc.pizzaCustomization.type,
            half: sc.half,
            action: sc.action
          })),
          quantity: quantity,
          totalPrice: totalPrice,
          // Preserve other fields from first item
          selectedModifiers: firstItem.productModifiers.map((m: any) => m.id),
          selectedPizzaCustomizations: firstItem.selectedPizzaCustomizations.map((sc: any) => ({
            pizzaCustomizationId: sc.pizzaCustomizationId,
            half: sc.half,
            action: sc.action
          })),
          basePrice: firstItem.basePrice,
          finalPrice: firstItem.finalPrice,
          comments: firstItem.comments
        };
      });

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