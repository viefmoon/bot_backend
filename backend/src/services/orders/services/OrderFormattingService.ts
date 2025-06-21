import { NewOrder } from "../../../common/types/order.types";
import { env } from "../../../common/config/envValidator";

export class OrderFormattingService {
  /**
   * Format an order for WhatsApp message display
   */
  static formatOrderForWhatsApp(order: any, customerId: string): NewOrder {
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
        nombre: mod.name || "Modificador",
        precio: mod.price || 0,
      })) || [];
      
      modifiers.forEach((mod: any) => {
        itemPrice += mod.precio;
      });
      
      const totalItemPrice = itemPrice * item.quantity;
      totalPrice += totalItemPrice;

      // Map pizza customizations
      const pizzaCustomizations = item.selectedPizzaCustomizations?.map((selectedCust: any) => ({
        mitad: selectedCust.half as string,
        nombre: selectedCust.pizzaCustomization?.name || "Personalización",
        action: selectedCust.action,
        tipo: selectedCust.pizzaCustomization?.type || "INGREDIENT",
        ingredientes: selectedCust.pizzaCustomization?.ingredients,
      })) || [];

      return {
        nombre: name,
        cantidad: item.quantity,
        precio: totalItemPrice,
        modificadores: modifiers,
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
      telefono: customerId,
      informacion_entrega: deliveryInfo,
      precio_total: totalPrice,
      fecha_creacion: createdAt,
      horario_entrega_programado: scheduledDelivery,
      tiempoEstimado: order.estimatedTime,
      productos: products,
    };
  }

  /**
   * Generate order confirmation message
   */
  static generateConfirmationMessage(order: any, formattedOrder: NewOrder): string {
    const orderTypeText = order.orderType === "DELIVERY" ? "A domicilio" : 
                         order.orderType === "TAKE_AWAY" ? "Para llevar" : "Para comer aquí";
    
    let message = `🎉 *¡Tu orden #${order.dailyNumber} ha sido creada exitosamente!* 🎉\n\n`;
    message += `📞 *Teléfono:* ${formattedOrder.telefono}\n`;
    message += `📅 *Fecha de creación:* ${formattedOrder.fecha_creacion}\n`;
    message += `🚚 *Información de entrega:* ${orderTypeText} - ${formattedOrder.informacion_entrega}\n`;
    message += `⏱️ *Tiempo estimado:* ${formattedOrder.tiempoEstimado} minutos\n`;

    if (formattedOrder.horario_entrega_programado) {
      message += `📅 *Entrega programada:* ${formattedOrder.horario_entrega_programado}\n`;
    }

    message += `\n🛒 *Productos:*\n`;
    formattedOrder.productos.forEach((producto) => {
      message += this.formatProduct(producto);
    });

    message += `\n💰 *Total: $${formattedOrder.precio_total}*\n\n`;
    message += `📩 Te notificaremos cuando tu pedido sea aceptado. ¡Gracias por tu preferencia! 🙏`;

    return message;
  }

  /**
   * Format a single product for display
   */
  private static formatProduct(producto: any): string {
    let summary = `- *${producto.cantidad}x ${producto.nombre}*: $${producto.precio}\n`;

    if (producto.pizzaCustomizations?.length > 0) {
      summary += this.formatPizzaCustomizations(producto.pizzaCustomizations);
    }

    if (producto.modificadores.length > 0) {
      summary += `  🔸 Modificadores: ${producto.modificadores
        .map((mod: any) => mod.nombre)
        .join(", ")}\n`;
    }

    if (producto.comments) {
      summary += `  💬 Comentarios: ${producto.comments}\n`;
    }

    return summary;
  }

  /**
   * Format pizza customizations for display
   */
  private static formatPizzaCustomizations(customizations: any[]): string {
    let summary = "  🔸 Personalización de pizza:\n";

    // Separate flavors and ingredients
    const flavors = customizations.filter((c: any) => c.tipo === "FLAVOR" && c.action === "ADD");
    const addedIngredients = customizations.filter((c: any) => c.tipo === "INGREDIENT" && c.action === "ADD");
    const removedItems = customizations.filter((c: any) => c.action === "REMOVE");

    // Show flavors
    if (flavors.length > 0) {
      const flavorsByHalf = {
        half1: flavors.filter((f: any) => f.mitad === "HALF_1"),
        half2: flavors.filter((f: any) => f.mitad === "HALF_2"),
        full: flavors.filter((f: any) => f.mitad === "FULL"),
      };

      if (flavorsByHalf.full.length > 0) {
        summary += `     • Sabor Completo: ${flavorsByHalf.full.map((f: any) => f.nombre).join(", ")}\n`;
      }
      if (flavorsByHalf.half1.length > 0) {
        summary += `     • Primera Mitad: ${flavorsByHalf.half1.map((f: any) => f.nombre).join(", ")}\n`;
      }
      if (flavorsByHalf.half2.length > 0) {
        summary += `     • Segunda Mitad: ${flavorsByHalf.half2.map((f: any) => f.nombre).join(", ")}\n`;
      }
    }

    // Show added ingredients
    if (addedIngredients.length > 0) {
      const ingredientsByHalf = {
        half1: addedIngredients.filter((i: any) => i.mitad === "HALF_1"),
        half2: addedIngredients.filter((i: any) => i.mitad === "HALF_2"),
        full: addedIngredients.filter((i: any) => i.mitad === "FULL"),
      };

      const half1Items = [...ingredientsByHalf.half1, ...ingredientsByHalf.full];
      const half2Items = [...ingredientsByHalf.half2, ...ingredientsByHalf.full];

      if (
        half1Items.length === half2Items.length &&
        half1Items.every((item: any) => half2Items.some((h2: any) => h2.nombre === item.nombre))
      ) {
        summary += `     • Ingredientes Extra: ${half1Items.map((i: any) => i.nombre).join(", ")}\n`;
      } else {
        if (half1Items.length > 0) {
          summary += `     • Extra Primera Mitad: ${half1Items.map((i: any) => i.nombre).join(", ")}\n`;
        }
        if (half2Items.length > 0) {
          summary += `     • Extra Segunda Mitad: ${half2Items.map((i: any) => i.nombre).join(", ")}\n`;
        }
      }
    }

    // Show removed items
    if (removedItems.length > 0) {
      summary += `     • ❌ Quitar: ${removedItems.map((r: any) => r.nombre).join(", ")}\n`;
    }

    return summary;
  }
}