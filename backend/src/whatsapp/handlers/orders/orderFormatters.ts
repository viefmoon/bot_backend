/**
 * Order formatting utilities
 * Handles the formatting of order summaries and product details
 */

import { env } from '../../../common/config/envValidator';

// Helper function to generate product summary
export function generateProductSummary(product: any): string {
  // Handle different product structures
  const quantity = product.quantity || product.cantidad || 1;
  const name = product.productName || product.variantName || product.nombre || 'Producto';
  const price = product.subtotal || product.precio || product.price || 0;
  
  let summary = `- *${quantity}x ${name}*: $${price}\n`;

  if (product.pizzaIngredients?.length > 0 || product.ingredientes_pizza?.length > 0) {
    summary += generatePizzaIngredientsSummary(product.pizzaIngredients || product.ingredientes_pizza);
  }

  if (product.modifiers?.length > 0 || product.modificadores?.length > 0) {
    const modifiers = product.modifiers || product.modificadores;
    summary += `  🔸 Modificadores: ${modifiers
      .map((mod: any) => mod.name || mod.nombre)
      .join(", ")}\n`;
  }

  if (product.comments || product.comentarios) {
    summary += `  💬 Comentarios: ${product.comments || product.comentarios}\n`;
  }

  return summary;
}

// Helper function to generate pizza ingredients summary
export function generatePizzaIngredientsSummary(ingredients: any[]): string {
  let summary = "  🔸 Ingredientes de pizza:\n";

  const ingredientsByHalf = {
    left: ingredients
      .filter((ing: any) => ing.half === "left" || ing.mitad === "left")
      .map((ing: any) => ing.name || ing.nombre),
    right: ingredients
      .filter((ing: any) => ing.half === "right" || ing.mitad === "right")
      .map((ing: any) => ing.name || ing.nombre),
    full: ingredients
      .filter((ing: any) => ing.half === "full" || ing.mitad === "full")
      .map((ing: any) => ing.name || ing.nombre),
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
    // Same ingredients on both halves
    summary += `     • Completa: ${leftIngredients.join(", ")}\n`;
  } else {
    // Different ingredients on each half
    if (leftIngredients.length > 0) {
      summary += `     • Mitad Izquierda: ${leftIngredients.join(", ")}\n`;
    }
    if (rightIngredients.length > 0) {
      summary += `     • Mitad Derecha: ${rightIngredients.join(", ")}\n`;
    }
  }

  // Show special actions (remove)
  const removedIngredients = ingredients
    .filter((ing: any) => ing.action === "remove")
    .map((ing: any) => ing.name || ing.nombre);
  if (removedIngredients.length > 0) {
    summary += `     • ❌ Quitar: ${removedIngredients.join(", ")}\n`;
  }

  return summary;
}

// Function to generate complete order summary
export function generateOrderSummary(order: any): string {
  const deliveryTypeText = order.orderType === "delivery" ? "Entrega a domicilio" : "Recolección en establecimiento";
  
  let message = `📋 *Resumen de tu pedido:*\n\n`;
  message += `📦 *Tipo de orden:* ${deliveryTypeText}\n\n`;
  
  if (order.orderType === "pickup" && order.pickupName) {
    message += `👤 *Nombre para recoger:* ${order.pickupName}\n\n`;
  }
  
  if (order.orderType === "delivery" && order.deliveryInfo) {
    // Combine street, number and interior number
    let fullAddress = order.deliveryInfo.street || "";
    if (order.deliveryInfo.number) {
      fullAddress += ` ${order.deliveryInfo.number}`;
    }
    if (order.deliveryInfo.interiorNumber) {
      fullAddress += ` Int. ${order.deliveryInfo.interiorNumber}`;
    }
    message += `📍 *Dirección de entrega:*\n${fullAddress}\n`;
    if (order.deliveryInfo.neighborhood) {
      message += `Colonia: ${order.deliveryInfo.neighborhood}\n`;
    }
    if (order.deliveryInfo.references) {
      message += `Referencias: ${order.deliveryInfo.references}\n`;
    }
    message += "\n";
  }
  
  message += `🛒 *Productos:*\n`;
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      message += generateProductSummary(item);
    });
  } else {
    message += `_No hay productos en el pedido_\n`;
  }
  
  message += `\n💰 *Total: $${order.total || '0.00'}*\n`;
  
  if (order.scheduledDeliveryTime) {
    const date = new Date(order.scheduledDeliveryTime);
    const formattedDate = date.toLocaleDateString(env.DEFAULT_LOCALE, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = date.toLocaleTimeString(env.DEFAULT_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
    });
    message += `\n⏰ *Programado para:* ${formattedDate} a las ${formattedTime}\n`;
  }
  
  return message;
}