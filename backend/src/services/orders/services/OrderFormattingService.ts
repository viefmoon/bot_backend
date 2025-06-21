import { FormattedOrder, FormattedOrderProduct } from "../../../common/types/order.types";
import { env } from "../../../common/config/envValidator";
import { PizzaHalf, CustomizationAction, CustomizationType } from "@prisma/client";

export class OrderFormattingService {
  /**
   * Format an order for WhatsApp message display
   */
  static formatOrderForWhatsApp(order: any, customerId: string): FormattedOrder {
    const orderType = order.orderType;
    let deliveryInfo = "";

    // Format delivery information
    if (orderType === "delivery" && order.deliveryInfo) {
      const info = order.deliveryInfo;
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
      if (info.references) parts.push(`(${info.references})`);
      deliveryInfo = parts.join(", ");
    } else if (orderType === "pickup" && order.deliveryInfo?.pickupName) {
      deliveryInfo = order.deliveryInfo.pickupName;
    }

    // Calculate total price
    let totalPrice = 0;
    const products = order.orderItems?.map((item: any) => {
      const productName = item.product?.name || "Producto";
      const variantName = item.productVariant?.name || "";
      const name = variantName ? `${productName} ${variantName}` : productName;
      
      // Calculate base price
      let itemPrice = item.productVariant?.price || 0;
      
      // Add modifier prices
      const modifiers = item.productModifiers?.map((mod: any) => ({
        name: mod.name || "Modificador",
        price: mod.price || 0,
      })) || [];
      
      modifiers.forEach((mod: any) => {
        itemPrice += mod.price;
      });
      
      const totalItemPrice = itemPrice * item.quantity;
      totalPrice += totalItemPrice;

      // Map pizza customizations
      const pizzaCustomizations = item.selectedPizzaCustomizations?.map((selectedCust: any) => ({
        half: selectedCust.half as string,
        name: selectedCust.pizzaCustomization?.name || "Personalización",
        action: selectedCust.action,
        type: selectedCust.pizzaCustomization?.type || "INGREDIENT",
        ingredients: selectedCust.pizzaCustomization?.ingredients,
      })) || [];

      return {
        name: name,
        quantity: item.quantity,
        price: totalItemPrice,
        modifiers: modifiers,
        pizzaCustomizations: pizzaCustomizations.length > 0 ? pizzaCustomizations : undefined,
        comments: item.comments,
      };
    }) || [];

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

    return {
      id: order.id,
      phoneNumber: customerId,
      deliveryInfo: deliveryInfo,
      totalPrice: totalPrice,
      createdAt: createdAt,
      scheduledDeliveryTime: scheduledDelivery,
      estimatedTime: order.estimatedTime,
      products: products,
    };
  }

  /**
   * Generate order confirmation message
   */
  static generateConfirmationMessage(order: any, formattedOrder: FormattedOrder): string {
    const orderTypeText = order.orderType === "DELIVERY" ? "A domicilio" : 
                         order.orderType === "TAKE_AWAY" ? "Para llevar" : "Para comer aquí";
    
    let message = `🎉 *¡Tu orden #${order.dailyNumber} ha sido creada exitosamente!* 🎉\n\n`;
    message += `📞 *Teléfono:* ${formattedOrder.phoneNumber}\n`;
    message += `📅 *Fecha de creación:* ${formattedOrder.createdAt}\n`;
    message += `🚚 *Información de entrega:* ${orderTypeText} - ${formattedOrder.deliveryInfo}\n`;
    message += `⏱️ *Tiempo estimado:* ${formattedOrder.estimatedTime} minutos\n`;

    if (formattedOrder.scheduledDeliveryTime) {
      message += `📅 *Entrega programada:* ${formattedOrder.scheduledDeliveryTime}\n`;
    }

    message += `\n🛒 *Productos:*\n`;
    formattedOrder.products.forEach((product) => {
      message += this.formatProduct(product);
    });

    message += `\n💰 *Total: $${formattedOrder.totalPrice}*\n\n`;
    message += `📩 Te notificaremos cuando tu pedido sea aceptado. ¡Gracias por tu preferencia! 🙏`;

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
    let summary = "  🔸 Personalización de pizza:\n";

    // Separate flavors and ingredients
    const flavors = customizations.filter((c: any) => c.type === CustomizationType.FLAVOR && c.action === CustomizationAction.ADD);
    const addedIngredients = customizations.filter((c: any) => c.type === CustomizationType.INGREDIENT && c.action === CustomizationAction.ADD);
    const removedItems = customizations.filter((c: any) => c.action === CustomizationAction.REMOVE);

    // Show flavors
    if (flavors.length > 0) {
      const flavorsByHalf = {
        half1: flavors.filter((f: any) => f.half === PizzaHalf.HALF_1),
        half2: flavors.filter((f: any) => f.half === PizzaHalf.HALF_2),
        full: flavors.filter((f: any) => f.half === PizzaHalf.FULL),
      };

      if (flavorsByHalf.full.length > 0) {
        summary += `     • Sabor Completo: ${flavorsByHalf.full.map((f: any) => f.name).join(", ")}\n`;
      }
      if (flavorsByHalf.half1.length > 0) {
        summary += `     • Primera Mitad: ${flavorsByHalf.half1.map((f: any) => f.name).join(", ")}\n`;
      }
      if (flavorsByHalf.half2.length > 0) {
        summary += `     • Segunda Mitad: ${flavorsByHalf.half2.map((f: any) => f.name).join(", ")}\n`;
      }
    }

    // Show added ingredients
    if (addedIngredients.length > 0) {
      const ingredientsByHalf = {
        half1: addedIngredients.filter((i: any) => i.half === PizzaHalf.HALF_1),
        half2: addedIngredients.filter((i: any) => i.half === PizzaHalf.HALF_2),
        full: addedIngredients.filter((i: any) => i.half === PizzaHalf.FULL),
      };

      const half1Items = [...ingredientsByHalf.half1, ...ingredientsByHalf.full];
      const half2Items = [...ingredientsByHalf.half2, ...ingredientsByHalf.full];

      if (
        half1Items.length === half2Items.length &&
        half1Items.every((item: any) => half2Items.some((h2: any) => h2.name === item.name))
      ) {
        summary += `     • Ingredientes Extra: ${half1Items.map((i: any) => i.name).join(", ")}\n`;
      } else {
        if (half1Items.length > 0) {
          summary += `     • Extra Primera Mitad: ${half1Items.map((i: any) => i.name).join(", ")}\n`;
        }
        if (half2Items.length > 0) {
          summary += `     • Extra Segunda Mitad: ${half2Items.map((i: any) => i.name).join(", ")}\n`;
        }
      }
    }

    // Show removed items
    if (removedItems.length > 0) {
      summary += `     • ❌ Quitar: ${removedItems.map((r: any) => r.name).join(", ")}\n`;
    }

    return summary;
  }
}