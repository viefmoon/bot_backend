import { Order, OrderItem, OrderType } from "@prisma/client";
import { NewOrder } from "../../../common/types/order.types";

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
      const modifiers = item.selectedModifiers?.map((selectedMod: any) => ({
        nombre: selectedMod.modifier?.name || "Modificador",
        precio: selectedMod.modifier?.price || 0,
      })) || [];
      
      modifiers.forEach((mod: any) => {
        itemPrice += mod.precio;
      });
      
      const totalItemPrice = itemPrice * item.quantity;
      totalPrice += totalItemPrice;

      // Map pizza ingredients
      const pizzaIngredients = item.selectedPizzaIngredients?.map((selectedIng: any) => ({
        mitad: selectedIng.half as string,
        nombre: selectedIng.pizzaIngredient?.name || "Ingrediente",
        action: selectedIng.action,
      })) || [];

      return {
        nombre: name,
        cantidad: item.quantity,
        precio: totalItemPrice,
        modificadores: modifiers,
        ingredientes_pizza: pizzaIngredients.length > 0 ? pizzaIngredients : undefined,
        comments: item.comments,
      };
    }) || [];

    // Format dates
    const createdAt = order.createdAt.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const scheduledDelivery = order.scheduledDeliveryTime
      ? order.scheduledDeliveryTime.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
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
    const orderTypeText = order.orderType === "delivery" ? "A domicilio" : "Recolección";
    
    let message = `🎉 *¡Tu orden #${order.dailyOrderNumber} ha sido creada exitosamente!* 🎉\n\n`;
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

    if (producto.ingredientes_pizza?.length > 0) {
      summary += this.formatPizzaIngredients(producto.ingredientes_pizza);
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
   * Format pizza ingredients for display
   */
  private static formatPizzaIngredients(ingredientes: any[]): string {
    let summary = "  🔸 Ingredientes de pizza:\n";

    const ingredientsByHalf = {
      left: ingredientes
        .filter((ing: any) => ing.mitad === "left")
        .map((ing: any) => ing.nombre),
      right: ingredientes
        .filter((ing: any) => ing.mitad === "right")
        .map((ing: any) => ing.nombre),
      full: ingredientes
        .filter((ing: any) => ing.mitad === "full")
        .map((ing: any) => ing.nombre),
    };

    const leftIngredients = [
      ...ingredientsByHalf.left,
      ...ingredientsByHalf.full,
    ];
    const rightIngredients = [
      ...ingredientsByHalf.right,
      ...ingredientsByHalf.full,
    ];

    if (
      leftIngredients.length === rightIngredients.length &&
      leftIngredients.every((ing: string) => rightIngredients.includes(ing))
    ) {
      summary += `     • Completa: ${leftIngredients.join(", ")}\n`;
    } else {
      if (leftIngredients.length > 0) {
        summary += `     • Mitad Izquierda: ${leftIngredients.join(", ")}\n`;
      }
      if (rightIngredients.length > 0) {
        summary += `     • Mitad Derecha: ${rightIngredients.join(", ")}\n`;
      }
    }

    // Show removed ingredients
    const removedIngredients = ingredientes
      .filter((ing: any) => ing.action === "remove")
      .map((ing: any) => ing.nombre);
    if (removedIngredients.length > 0) {
      summary += `     • ❌ Quitar: ${removedIngredients.join(", ")}\n`;
    }

    return summary;
  }
}