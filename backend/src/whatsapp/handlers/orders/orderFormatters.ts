/**
 * Order formatting utilities
 * Handles the formatting of order summaries and product details
 */

import { env } from '../../../common/config/envValidator';
import { PizzaHalf, CustomizationAction } from '@prisma/client';

// Helper function to generate product summary
export function generateProductSummary(product: any): string {
  // Handle different product structures
  const quantity = product.quantity || product.cantidad || 1;
  
  // Access nested product and variant data
  const productName = product.product?.name || product.productName || product.nombre || 'Producto';
  const variantName = product.productVariant?.name || product.variantName || '';
  const displayName = variantName || productName;
  
  // Calculate price - access from nested structures
  const unitPrice = product.productVariant?.price || product.product?.price || product.unitPrice || product.price || 0;
  const totalPrice = product.itemPrice || product.subtotal || product.precio || (unitPrice * quantity) || 0;
  
  // Start with product line showing quantity, name and total price
  let summary = `• *${quantity}x ${displayName}* - $${totalPrice}\n`;

  // Show modifiers if they exist
  if (product.modifiers?.length > 0 || product.modificadores?.length > 0) {
    const modifiers = product.modifiers || product.modificadores;
    const modifierNames = modifiers.map((mod: any) => mod.name || mod.nombre || mod).join(", ");
    summary += `  ${modifierNames}\n`;
  }

  // Show pizza customizations if it's a pizza
  const isPizza = product.product?.isPizza || product.isPizza;
  if (isPizza && product.pizzaCustomizations?.length > 0) {
    summary += formatPizzaCustomizations(product.pizzaCustomizations);
  }

  // Show comments if they exist
  if (product.comments || product.comentarios) {
    summary += `  Nota: ${product.comments || product.comentarios}\n`;
  }

  return summary;
}

// New function to format pizza customizations in a more intuitive way
function formatPizzaCustomizations(customizations: any[]): string {
  const addCustomizations = customizations.filter((cust: any) => 
    !cust.action || cust.action === CustomizationAction.ADD
  );
  const removeCustomizations = customizations.filter((cust: any) => 
    cust.action === CustomizationAction.REMOVE
  );

  let result = "";

  // Format additions
  if (addCustomizations.length > 0) {
    const byHalf = {
      group1: addCustomizations.filter((cust: any) => cust.half === PizzaHalf.HALF_1),
      group2: addCustomizations.filter((cust: any) => cust.half === PizzaHalf.HALF_2),
      full: addCustomizations.filter((cust: any) => cust.half === PizzaHalf.FULL)
    };

    // Get all ingredients for each half
    const group1Names = [...byHalf.group1, ...byHalf.full].map(i => i.name).sort();
    const group2Names = [...byHalf.group2, ...byHalf.full].map(i => i.name).sort();
    
    // Check if both groups have the same ingredients
    if (JSON.stringify(group1Names) === JSON.stringify(group2Names) && group1Names.length > 0) {
      // Same ingredients on both halves - show as complete
      result += `  Con: ${group1Names.join(", ")} (completa)\n`;
    } else {
      // Different ingredients per half
      const parts = [];
      
      // Collect unique ingredients for each group
      const group1Only = byHalf.group1.map(i => i.name);
      const group2Only = byHalf.group2.map(i => i.name);
      
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
        const fullNames = byHalf.full.map(i => i.name).join(", ");
        result += `  Con: ${fullNames} (completa)\n`;
      }
    }
  }

  // Format removals
  if (removeCustomizations.length > 0) {
    const names = removeCustomizations.map(c => c.name).join(", ");
    result += `  Sin: ${names}\n`;
  }

  return result;
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
  
  // Agregar mensaje informativo
  message += `\n📝 *¿Deseas agregar más artículos o modificar tu orden?*\n`;
  message += `Usa el botón *Cancelar* para reiniciar tu pedido desde cero.\n`;
  
  return message;
}