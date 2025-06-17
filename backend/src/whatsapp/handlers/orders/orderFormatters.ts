/**
 * Order formatting utilities
 * Handles the formatting of order summaries and product details
 */

// Función auxiliar para generar el resumen de productos
export function generateProductSummary(producto: any): string {
  let summary = `- *${producto.cantidad}x ${producto.nombre}*: $${producto.precio}\n`;

  if (producto.ingredientes_pizza?.length > 0) {
    summary += generatePizzaIngredientsSummary(producto.ingredientes_pizza);
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

// Función auxiliar para generar el resumen de ingredientes de pizza
export function generatePizzaIngredientsSummary(ingredientes: any[]): string {
  let summary = "  🔸 Ingredientes de pizza:\n";

  const ingredientesPorMitad = {
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
    ...ingredientesPorMitad.left,
    ...ingredientesPorMitad.full,
  ];
  const rightIngredients = [
    ...ingredientesPorMitad.right,
    ...ingredientesPorMitad.full,
  ];

  if (
    leftIngredients.length === rightIngredients.length &&
    leftIngredients.every((ing: string) => rightIngredients.includes(ing))
  ) {
    // Los ingredientes son los mismos en ambas mitades
    summary += `     • Completa: ${leftIngredients.join(", ")}\n`;
  } else {
    // Los ingredientes son diferentes en cada mitad
    if (leftIngredients.length > 0) {
      summary += `     • Mitad Izquierda: ${leftIngredients.join(", ")}\n`;
    }
    if (rightIngredients.length > 0) {
      summary += `     • Mitad Derecha: ${rightIngredients.join(", ")}\n`;
    }
  }

  // Mostrar si hay acciones especiales (remover)
  const removedIngredients = ingredientes
    .filter((ing: any) => ing.action === "remove")
    .map((ing: any) => ing.nombre);
  if (removedIngredients.length > 0) {
    summary += `     • ❌ Quitar: ${removedIngredients.join(", ")}\n`;
  }

  return summary;
}

// Función para generar el resumen completo de la orden
export function generateOrderSummary(result: any): string {
  const deliveryType = result.orderType === "delivery" ? "Entrega a domicilio" : "Recolección en establecimiento";
  
  let message = `📋 *Resumen de tu pedido:*\n\n`;
  message += `📦 *Tipo de orden:* ${deliveryType}\n\n`;
  
  if (result.orderType === "pickup" && result.pickupName) {
    message += `👤 *Nombre para recoger:* ${result.pickupName}\n\n`;
  }
  
  if (result.orderType === "delivery" && result.deliveryInfo) {
    message += `📍 *Dirección de entrega:*\n${result.deliveryInfo.streetAddress}\n`;
    if (result.deliveryInfo.neighborhood) {
      message += `Colonia: ${result.deliveryInfo.neighborhood}\n`;
    }
    if (result.deliveryInfo.additionalDetails) {
      message += `Referencias: ${result.deliveryInfo.additionalDetails}\n`;
    }
    message += "\n";
  }
  
  message += `🛒 *Productos:*\n`;
  result.productos.forEach((producto: any) => {
    message += generateProductSummary(producto);
  });
  
  message += `\n💰 *Total: $${result.costoTotal}*\n`;
  
  if (result.scheduledDeliveryTime) {
    const date = new Date(result.scheduledDeliveryTime);
    const formattedDate = date.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    message += `\n⏰ *Programado para:* ${formattedDate} a las ${formattedTime}\n`;
  }
  
  return message;
}