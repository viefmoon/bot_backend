import { FormattedOrder, FormattedOrderProduct } from "../../../common/types/order.types";
import { env } from "../../../common/config/envValidator";
import { PizzaHalf, CustomizationAction, CustomizationType, OrderType } from "@prisma/client";
import { ConfigService } from "../../config/ConfigService";

export class OrderFormattingService {
  /**
   * Format an order for WhatsApp message display
   */
  static formatOrderForWhatsApp(order: any, customerId: string): FormattedOrder {
    const orderType = order.orderType;
    let deliveryInfo = "";

    // Format delivery information
    if (orderType === OrderType.DELIVERY && order.deliveryInfo) {
      const info = order.deliveryInfo;
      
      // Use full address if available (for phone orders)
      if (info.fullAddress) {
        deliveryInfo = info.fullAddress;
      } else {
        const parts = [];
        // Combine street, number, and interior number
        let fullAddress = info.street || "";
        if (info.number) {
          fullAddress += ` ${info.number}`;
        }
        if (info.interiorNumber) {
          fullAddress += ` Int. ${info.interiorNumber}`;
        }
        if (fullAddress.trim()) parts.push(fullAddress.trim());
        if (info.neighborhood) parts.push(info.neighborhood);
        if (info.city) parts.push(info.city);
        if (info.deliveryInstructions) parts.push(`(${info.deliveryInstructions})`);
        deliveryInfo = parts.join(", ");
      }
      
      // Add recipient info if different from customer
      if (info.recipientName) {
        deliveryInfo += ` - Para: ${info.recipientName}`;
      }
      if (info.recipientPhone) {
        deliveryInfo += ` Tel: ${info.recipientPhone}`;
      }
    } else if (orderType === OrderType.TAKE_AWAY && order.deliveryInfo?.recipientName) {
      deliveryInfo = `Recogerá: ${order.deliveryInfo.recipientName}`;
      if (order.deliveryInfo.recipientPhone) {
        deliveryInfo += ` - Tel: ${order.deliveryInfo.recipientPhone}`;
      }
    }

    // Group items by product and variant
    const itemGroups: { [key: string]: any[] } = {};
    
    // Group items by product and variant
    order.orderItems?.forEach((item: any) => {
      const key = `${item.productId}_${item.productVariantId || 'null'}`;
      if (!itemGroups[key]) {
        itemGroups[key] = [];
      }
      itemGroups[key].push(item);
    });
    
    const products = Object.values(itemGroups).map((items: any[]) => {
      const item = items[0]; // Take first item as reference
      const productName = item.product?.name || item.productName || "Producto";
      const variantName = item.productVariant?.name || item.variantName || "";
      // When product has variants, show only the variant name
      const name = variantName || productName;
      
      // Calculate total for all items in this group
      const quantity = items.length;
      const unitPrice = item.finalPrice || item.basePrice || 0;
      const groupTotalPrice = unitPrice * quantity;
      
      // Modifiers are already included in finalPrice during order creation
      const modifiers = item.productModifiers?.map((mod: any) => ({
        name: mod.name || "Modificador",
        price: mod.price || 0,
      })) || [];

      // Map pizza customizations from first item (they should be the same)
      const pizzaCustomizations = item.selectedPizzaCustomizations?.map((selectedCust: any) => ({
        half: selectedCust.half as string,
        name: selectedCust.pizzaCustomization?.name || "Personalización",
        action: selectedCust.action,
        type: selectedCust.pizzaCustomization?.type || "INGREDIENT",
        ingredients: selectedCust.pizzaCustomization?.ingredients,
      })) || [];

      return {
        name: name,
        quantity: quantity,
        price: groupTotalPrice,
        modifiers: modifiers,
        pizzaCustomizations: pizzaCustomizations?.length > 0 ? pizzaCustomizations : undefined,
        comments: item.comments,
      };
    });

    // Format dates
    const createdAt = order.createdAt.toLocaleString(env.DEFAULT_LOCALE, {
      timeZone: env.DEFAULT_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const scheduledDelivery = order.scheduledAt
      ? order.scheduledAt.toLocaleString(env.DEFAULT_LOCALE, {
          timeZone: env.DEFAULT_TIMEZONE,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    // Use the total from order directly
    const totalPrice = order.total || 0;

    return {
      id: order.id,
      shiftOrderNumber: order.shiftOrderNumber,
      orderType: order.orderType,
      customerId: order.customerId,
      phoneNumber: order.customer?.whatsappPhoneNumber || customerId,
      deliveryInfo: deliveryInfo,
      totalPrice: totalPrice,
      createdAt: createdAt,
      scheduledDeliveryTime: scheduledDelivery,
      estimatedDeliveryTime: order.estimatedDeliveryTime 
        ? new Date(order.estimatedDeliveryTime).toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : undefined,
      products: products,
    };
  }

  /**
   * Generate order confirmation message
   */
  static async generateConfirmationMessage(order: any, formattedOrder: FormattedOrder): Promise<string> {
    const orderTypeText = order.orderType === OrderType.DELIVERY ? "A domicilio" : 
                         order.orderType === OrderType.TAKE_AWAY ? "Para llevar" : "Para comer aquí";
    
    const config = await ConfigService.getConfig();
    
    let message = `📅 *Fecha de creación:* ${formattedOrder.createdAt}\n`;
    message += `🚚 *Información de entrega:* ${orderTypeText} - ${formattedOrder.deliveryInfo}\n`;
    message += `📞 *Teléfono:* ${formattedOrder.phoneNumber}\n`;
    
    if (formattedOrder.estimatedDeliveryTime) {
      message += `⏱️ *Hora estimada de entrega:* ${formattedOrder.estimatedDeliveryTime}\n`;
    }

    if (formattedOrder.scheduledDeliveryTime) {
      message += `📅 *Entrega programada:* ${formattedOrder.scheduledDeliveryTime}\n`;
    }

    message += `\n🛒 *Productos:*\n`;
    formattedOrder.products.forEach((product) => {
      message += this.formatProduct(product);
    });

    message += `\n💰 *Total: $${formattedOrder.totalPrice}*\n\n`;
    message += `📩 Te notificaremos cuando tu pedido sea aceptado.\n\n`;
    
    // Add restaurant contact info
    message += `📞 *¿Necesitas hacer cambios?*\n`;
    message += `Comunícate directamente con el restaurante:\n`;
    if (config.phoneMain) {
      message += `📱 ${config.phoneMain}\n`;
    }
    if (config.phoneSecondary) {
      message += `📱 ${config.phoneSecondary}\n`;
    }
    
    message += `\n¡Gracias por tu preferencia! 🙏`;

    return message;
  }

  /**
   * Format a single product for display
   */
  private static formatProduct(product: FormattedOrderProduct): string {
    let summary = `- *${product.quantity}x ${product.name}*: $${product.price}\n`;

    if (product.pizzaCustomizations && product.pizzaCustomizations.length > 0) {
      summary += this.formatPizzaCustomizations(product.pizzaCustomizations);
    }

    if (product.modifiers.length > 0) {
      summary += `  🔸 Modificadores: ${product.modifiers
        .map((mod: any) => mod.name)
        .join(", ")}\n`;
    }

    if (product.comments) {
      summary += `  💬 Comentarios: ${product.comments}\n`;
    }

    return summary;
  }

  /**
   * Format pizza customizations for display
   */
  private static formatPizzaCustomizations(customizations: any[]): string {
    const addCustomizations = customizations.filter((c: any) => c.action === CustomizationAction.ADD);
    const removeCustomizations = customizations.filter((c: any) => c.action === CustomizationAction.REMOVE);
    
    let result = "";
    
    // Group by type and half
    const flavors = {
      HALF_1: addCustomizations.filter(c => c.type === CustomizationType.FLAVOR && c.half === PizzaHalf.HALF_1),
      HALF_2: addCustomizations.filter(c => c.type === CustomizationType.FLAVOR && c.half === PizzaHalf.HALF_2),
      FULL: addCustomizations.filter(c => c.type === CustomizationType.FLAVOR && c.half === PizzaHalf.FULL)
    };
    
    const ingredients = {
      HALF_1: addCustomizations.filter(c => c.type === CustomizationType.INGREDIENT && c.half === PizzaHalf.HALF_1),
      HALF_2: addCustomizations.filter(c => c.type === CustomizationType.INGREDIENT && c.half === PizzaHalf.HALF_2),
      FULL: addCustomizations.filter(c => c.type === CustomizationType.INGREDIENT && c.half === PizzaHalf.FULL)
    };
    
    const removed = {
      HALF_1: removeCustomizations.filter(c => c.half === PizzaHalf.HALF_1),
      HALF_2: removeCustomizations.filter(c => c.half === PizzaHalf.HALF_2),
      FULL: removeCustomizations.filter(c => c.half === PizzaHalf.FULL)
    };
    
    // Format full pizza
    if (flavors.FULL.length > 0 || ingredients.FULL.length > 0 || removed.FULL.length > 0) {
      const parts = [];
      if (flavors.FULL.length > 0) {
        parts.push(flavors.FULL.map(f => f.name).join(", "));
      }
      if (ingredients.FULL.length > 0) {
        parts.push(`con: ${ingredients.FULL.map(i => i.name).join(", ")}`);
      }
      if (removed.FULL.length > 0) {
        parts.push(`sin: ${removed.FULL.map(r => r.name).join(", ")}`);
      }
      result += `  🔸 ${parts.join(" - ")}\n`;
    }
    
    // Format half pizzas
    const hasHalf1 = flavors.HALF_1.length > 0 || ingredients.HALF_1.length > 0 || removed.HALF_1.length > 0;
    const hasHalf2 = flavors.HALF_2.length > 0 || ingredients.HALF_2.length > 0 || removed.HALF_2.length > 0;
    
    if (hasHalf1 && hasHalf2) {
      const half1Parts = [];
      const half2Parts = [];
      
      // Build half 1
      if (flavors.HALF_1.length > 0) {
        half1Parts.push(flavors.HALF_1.map(f => f.name).join(", "));
      }
      if (ingredients.HALF_1.length > 0) {
        half1Parts.push(`con: ${ingredients.HALF_1.map(i => i.name).join(", ")}`);
      }
      if (removed.HALF_1.length > 0) {
        half1Parts.push(`sin: ${removed.HALF_1.map(r => r.name).join(", ")}`);
      }
      
      // Build half 2
      if (flavors.HALF_2.length > 0) {
        half2Parts.push(flavors.HALF_2.map(f => f.name).join(", "));
      }
      if (ingredients.HALF_2.length > 0) {
        half2Parts.push(`con: ${ingredients.HALF_2.map(i => i.name).join(", ")}`);
      }
      if (removed.HALF_2.length > 0) {
        half2Parts.push(`sin: ${removed.HALF_2.map(r => r.name).join(", ")}`);
      }
      
      result += `  🔸 (${half1Parts.join(" ")} / ${half2Parts.join(" ")})\n`;
    }
    
    return result;
  }
}