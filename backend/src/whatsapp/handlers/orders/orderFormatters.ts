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
  
  // For CalculatedOrderItem structure
  const productName = product.productName || product.product?.name || product.nombre || 'Producto';
  const variantName = product.variantName || product.productVariant?.name || '';
  // When product has variants, show only the variant name
  const displayName = variantName || productName;
  
  // Calculate price - use totalPrice for CalculatedOrderItem
  const totalPrice = product.totalPrice || product.itemPrice || product.subtotal || product.precio || 0;
  
  // Start with product line showing quantity, name and total price
  let summary = `• *${quantity}x ${displayName}* - $${totalPrice}\n`;

  // Show modifiers if they exist
  if (product.modifierNames?.length > 0) {
    // We have modifier names from CalculatedOrderItem
    summary += `  ${product.modifierNames.join(", ")}\n`;
  } else if (product.selectedModifiers?.length > 0) {
    // We only have IDs
    summary += `  ${product.selectedModifiers.length} modificador(es)\n`;
  } else if (product.modifiers?.length > 0 || product.modificadores?.length > 0) {
    const modifiers = product.modifiers || product.modificadores;
    const modifierNames = modifiers.map((mod: any) => mod.name || mod.nombre || mod).join(", ");
    summary += `  ${modifierNames}\n`;
  }

  // Show pizza customizations if it's a pizza
  const isPizza = product.product?.isPizza || product.isPizza;
  if (isPizza && product.pizzaCustomizationDetails?.length > 0) {
    // We have full details from CalculatedOrderItem
    summary += formatDetailedPizzaCustomizations(product.pizzaCustomizationDetails);
  } else if (isPizza && product.selectedPizzaCustomizations?.length > 0) {
    // We only have basic structure
    summary += formatPizzaCustomizations(product.selectedPizzaCustomizations);
  } else if (isPizza && product.pizzaCustomizations?.length > 0) {
    summary += formatPizzaCustomizations(product.pizzaCustomizations);
  }

  // Show comments if they exist
  if (product.comments || product.comentarios) {
    summary += `  Nota: ${product.comments || product.comentarios}\n`;
  }

  return summary;
}

// Function to format pizza customizations when we have names but not necessarily types
function formatPizzaCustomizations(customizations: any[]): string {
  const addCustomizations = customizations.filter((cust: any) => 
    !cust.action || cust.action === CustomizationAction.ADD || cust.action === 'ADD'
  );
  const removeCustomizations = customizations.filter((cust: any) => 
    cust.action === CustomizationAction.REMOVE || cust.action === 'REMOVE'
  );

  let result = "";

  // Check if we have names
  const hasNames = customizations.some(c => c.name);
  
  if (!hasNames) {
    // We only have IDs, show count
    const totalCustomizations = addCustomizations.length;
    const removeCount = removeCustomizations.length;
    result += `  ${totalCustomizations} personalización(es)`;
    if (removeCount > 0) {
      result += `, ${removeCount} ingrediente(s) removido(s)`;
    }
    result += '\n';
    return result;
  }

  // Group by half
  const added = {
    HALF_1: addCustomizations.filter(c => c.half === PizzaHalf.HALF_1 || c.half === 'HALF_1'),
    HALF_2: addCustomizations.filter(c => c.half === PizzaHalf.HALF_2 || c.half === 'HALF_2'),
    FULL: addCustomizations.filter(c => c.half === PizzaHalf.FULL || c.half === 'FULL')
  };
  
  const removed = {
    HALF_1: removeCustomizations.filter(c => c.half === PizzaHalf.HALF_1 || c.half === 'HALF_1'),
    HALF_2: removeCustomizations.filter(c => c.half === PizzaHalf.HALF_2 || c.half === 'HALF_2'),
    FULL: removeCustomizations.filter(c => c.half === PizzaHalf.FULL || c.half === 'FULL')
  };

  // Format full pizza
  if (added.FULL.length > 0 || removed.FULL.length > 0) {
    const parts = [];
    if (added.FULL.length > 0) {
      parts.push(`${added.FULL.map(c => c.name).join(", ")}`);
    }
    if (removed.FULL.length > 0) {
      parts.push(`sin: ${removed.FULL.map(c => c.name).join(", ")}`);
    }
    result += `  ${parts.join(" - ")}\n`;
  }

  // Format half pizzas
  const hasHalf1 = added.HALF_1.length > 0 || removed.HALF_1.length > 0;
  const hasHalf2 = added.HALF_2.length > 0 || removed.HALF_2.length > 0;
  
  if (hasHalf1 && hasHalf2) {
    const half1Parts = [];
    const half2Parts = [];
    
    // Build half 1
    if (added.HALF_1.length > 0) {
      half1Parts.push(added.HALF_1.map(c => c.name).join(", "));
    }
    if (removed.HALF_1.length > 0) {
      half1Parts.push(`sin: ${removed.HALF_1.map(c => c.name).join(", ")}`);
    }
    
    // Build half 2
    if (added.HALF_2.length > 0) {
      half2Parts.push(added.HALF_2.map(c => c.name).join(", "));
    }
    if (removed.HALF_2.length > 0) {
      half2Parts.push(`sin: ${removed.HALF_2.map(c => c.name).join(", ")}`);
    }
    
    result += `  (${half1Parts.join(" - ")} / ${half2Parts.join(" - ")})\n`;
  } else if (hasHalf1 || hasHalf2) {
    // Only one half
    const half = hasHalf1 ? 'HALF_1' : 'HALF_2';
    const parts = [];
    if (added[half].length > 0) {
      parts.push(added[half].map(c => c.name).join(", "));
    }
    if (removed[half].length > 0) {
      parts.push(`sin: ${removed[half].map(c => c.name).join(", ")}`);
    }
    result += `  ${parts.join(" - ")} (mitad)\n`;
  }

  return result;
}


// Function to format detailed pizza customizations
function formatDetailedPizzaCustomizations(customizations: any[]): string {
  const addCustomizations = customizations.filter(c => c.action === 'ADD');
  const removeCustomizations = customizations.filter(c => c.action === 'REMOVE');
  
  let result = "";
  
  // Group by type and half
  const flavors = {
    HALF_1: addCustomizations.filter(c => c.type === 'FLAVOR' && c.half === 'HALF_1'),
    HALF_2: addCustomizations.filter(c => c.type === 'FLAVOR' && c.half === 'HALF_2'),
    FULL: addCustomizations.filter(c => c.type === 'FLAVOR' && c.half === 'FULL')
  };
  
  const ingredients = {
    HALF_1: addCustomizations.filter(c => c.type === 'INGREDIENT' && c.half === 'HALF_1'),
    HALF_2: addCustomizations.filter(c => c.type === 'INGREDIENT' && c.half === 'HALF_2'),
    FULL: addCustomizations.filter(c => c.type === 'INGREDIENT' && c.half === 'FULL')
  };
  
  const removed = {
    HALF_1: removeCustomizations.filter(c => c.half === 'HALF_1'),
    HALF_2: removeCustomizations.filter(c => c.half === 'HALF_2'),
    FULL: removeCustomizations.filter(c => c.half === 'FULL')
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
    result += `  ${parts.join(" - ")}\n`;
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
    
    result += `  (${half1Parts.join(" ")} / ${half2Parts.join(" ")})\n`;
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
    // Show address name if available
    if (order.deliveryInfo.name) {
      message += `📍 *Dirección de entrega:* ${order.deliveryInfo.name}\n`;
    } else {
      message += `📍 *Dirección de entrega:*\n`;
    }
    
    // Combine street, number and interior number
    let fullAddress = order.deliveryInfo.street || "";
    if (order.deliveryInfo.number) {
      fullAddress += ` ${order.deliveryInfo.number}`;
    }
    if (order.deliveryInfo.interiorNumber) {
      fullAddress += ` Int. ${order.deliveryInfo.interiorNumber}`;
    }
    message += `${fullAddress}\n`;
    if (order.deliveryInfo.neighborhood) {
      message += `Colonia: ${order.deliveryInfo.neighborhood}\n`;
    }
    if (order.deliveryInfo.deliveryInstructions) {
      message += `Referencias: ${order.deliveryInfo.deliveryInstructions}\n`;
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
  
  // Add estimated time if available
  if (order.estimatedDeliveryTime) {
    message += `\n⏱️ *Tiempo estimado:* ${order.estimatedDeliveryTime} minutos\n`;
  }
  
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