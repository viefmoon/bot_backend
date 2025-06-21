/**
 * Order formatting utilities
 * Handles the formatting of order summaries and product details
 */

import { env } from '../../../common/config/envValidator';

// Helper function to generate product summary
export function generateProductSummary(product: any): string {
  // Handle different product structures
  const quantity = product.quantity || product.cantidad || 1;
  
  // Use variant name if available, otherwise use product name
  const displayName = product.variantName || product.productName || product.nombre || 'Producto';
  
  // Calculate price
  const unitPrice = product.unitPrice || product.price || 0;
  const totalPrice = product.subtotal || product.itemPrice || product.precio || (unitPrice * quantity) || 0;
  
  // Start with product line showing quantity, name and total price
  let summary = `• *${quantity}x ${displayName}* - $${totalPrice}\n`;

  // Show modifiers if they exist
  if (product.modifiers?.length > 0 || product.modificadores?.length > 0) {
    const modifiers = product.modifiers || product.modificadores;
    const modifierNames = modifiers.map((mod: any) => mod.name || mod.nombre || mod).join(", ");
    summary += `  ${modifierNames}\n`;
  }

  // Show pizza ingredients if it's a pizza
  if (product.isPizza && (product.pizzaIngredients?.length > 0 || product.ingredientes_pizza?.length > 0)) {
    const ingredients = product.pizzaIngredients || product.ingredientes_pizza;
    summary += formatPizzaIngredients(ingredients);
  }

  // Show comments if they exist
  if (product.comments || product.comentarios) {
    summary += `  Nota: ${product.comments || product.comentarios}\n`;
  }

  return summary;
}

// New function to format pizza ingredients in a more intuitive way
function formatPizzaIngredients(ingredients: any[]): string {
  const addIngredients = ingredients.filter((ing: any) => 
    !ing.action || ing.action === "add" || ing.action === "ADD"
  );
  const removeIngredients = ingredients.filter((ing: any) => 
    ing.action === "remove" || ing.action === "REMOVE"
  );

  let result = "";

  // Format additions
  if (addIngredients.length > 0) {
    const byHalf = {
      group1: addIngredients.filter((ing: any) => 
        ing.half === "LEFT" || ing.half === "left" || ing.mitad === "left"
      ),
      group2: addIngredients.filter((ing: any) => 
        ing.half === "RIGHT" || ing.half === "right" || ing.mitad === "right"
      ),
      full: addIngredients.filter((ing: any) => 
        ing.half === "FULL" || ing.half === "full" || ing.mitad === "full" || !ing.half
      )
    };

    // Get all ingredients for each half
    const group1Names = [...byHalf.group1, ...byHalf.full].map(i => i.name || i.nombre).sort();
    const group2Names = [...byHalf.group2, ...byHalf.full].map(i => i.name || i.nombre).sort();
    
    // Check if both groups have the same ingredients
    if (JSON.stringify(group1Names) === JSON.stringify(group2Names) && group1Names.length > 0) {
      // Same ingredients on both halves - show as complete
      result += `  Con: ${group1Names.join(", ")} (completa)\n`;
    } else {
      // Different ingredients per half
      const parts = [];
      
      // Collect unique ingredients for each group
      const group1Only = byHalf.group1.map(i => i.name || i.nombre);
      const group2Only = byHalf.group2.map(i => i.name || i.nombre);
      
      if (group1Only.length > 0 && group2Only.length > 0) {
        // Both halves have different ingredients
        result += `  Con: ${group1Only.join(", ")} / ${group2Only.join(", ")}\n`;
      } else if (group1Only.length > 0 || group2Only.length > 0) {
        // Only one half has specific ingredients
        const halfIngredients = group1Only.length > 0 ? group1Only : group2Only;
        result += `  Con: ${halfIngredients.join(", ")} (mitad)\n`;
      }
      
      // Add full ingredients if any
      if (byHalf.full.length > 0) {
        const fullNames = byHalf.full.map(i => i.name || i.nombre).join(", ");
        result += `  Con: ${fullNames} (completa)\n`;
      }
    }
  }

  // Format removals
  if (removeIngredients.length > 0) {
    const names = removeIngredients.map(i => i.name || i.nombre).join(", ");
    result += `  Sin: ${names}\n`;
  }

  return result;
}

// Helper function to generate pizza ingredients summary (kept for backward compatibility)
export function generatePizzaIngredientsSummary(ingredients: any[]): string {
  return formatPizzaIngredients(ingredients);
}

// Function to generate complete order summary
export function generateOrderSummary(order: any): string {
  // Normalize orderType to lowercase for comparison
  const orderType = (order.orderType || '').toString().toLowerCase();
  const deliveryTypeText = orderType === "delivery" ? "Entrega a domicilio" : "Recolección en establecimiento";
  
  let message = `📋 *Resumen de tu pedido:*\n\n`;
  message += `📦 *Tipo de orden:* ${deliveryTypeText}\n\n`;
  
  if (orderType === "pickup" || orderType === "take_away") {
    if (order.pickupName) {
      message += `👤 *Nombre para recoger:* ${order.pickupName}\n\n`;
    }
  }
  
  if (orderType === "delivery" && order.deliveryInfo) {
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
  
  if (order.scheduledAt) {
    const date = new Date(order.scheduledAt);
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