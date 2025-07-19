// En: backend/src/whatsapp/handlers/orders/orderFormatters.ts

import { env } from '../../../common/config/envValidator';
import { CalculatedOrderItem } from '../../../common/types';
import { OrderType, CustomizationAction, CustomizationType } from '@prisma/client';

/**
 * Formatea las personalizaciones de una pizza de manera legible.
 * Esta función es ahora la ÚNICA responsable de formatear pizzas.
 * @param customizations - Array de `pizzaCustomizationDetails` del `CalculatedOrderItem`.
 * @returns Un string formateado que describe las personalizaciones.
 */
function formatPizzaCustomizations(customizations: CalculatedOrderItem['pizzaCustomizationDetails']): string {
  if (!customizations || customizations.length === 0) {
    return '';
  }

  // Agrupar personalizaciones por mitad (FULL, HALF_1, HALF_2)
  const groups = customizations.reduce((acc, cust) => {
    acc[cust.half] = acc[cust.half] || [];
    acc[cust.half].push(cust);
    return acc;
  }, {} as Record<string, typeof customizations>);

  // Función auxiliar para formatear una mitad
  const formatHalf = (halfCustoms: typeof customizations): string => {
    const flavors = halfCustoms.filter(c => c.type === CustomizationType.FLAVOR && c.action === CustomizationAction.ADD).map(c => c.name);
    const ingredients = halfCustoms.filter(c => c.type === CustomizationType.INGREDIENT && c.action === CustomizationAction.ADD).map(c => c.name);
    const removed = halfCustoms.filter(c => c.action === CustomizationAction.REMOVE).map(c => c.name);

    let parts: string[] = [];
    if (flavors.length > 0) parts.push(flavors.join(', '));
    if (ingredients.length > 0) parts.push(`con: ${ingredients.join(', ')}`);
    if (removed.length > 0) parts.push(`sin: ${removed.join(', ')}`);
    
    return parts.join(' - ');
  };

  const fullPizzaText = groups['FULL'] ? formatHalf(groups['FULL']) : '';
  const half1Text = groups['HALF_1'] ? formatHalf(groups['HALF_1']) : '';
  const half2Text = groups['HALF_2'] ? formatHalf(groups['HALF_2']) : '';

  let result = '';
  if (fullPizzaText) {
    result += `  ${fullPizzaText}\n`;
  }
  if (half1Text && half2Text) {
    result += `  (Mitad: ${half1Text} / Mitad: ${half2Text})\n`;
  } else if (half1Text) {
    result += `  (Mitad: ${half1Text})\n`;
  } else if (half2Text) {
    result += `  (Mitad: ${half2Text})\n`;
  }

  return result;
}

/**
 * Genera el resumen para un único producto del pedido.
 * Ahora espera un objeto `CalculatedOrderItem` bien definido.
 */
export function generateProductSummary(item: CalculatedOrderItem): string {
  // El nombre a mostrar es la variante si existe, si no, el producto principal.
  const displayName = item.variantName || item.productName;
  
  // La cantidad ahora se maneja en el objeto principal.
  let summary = `• *${item.quantity}x ${displayName}* - $${item.totalPrice}\n`;

  // Añadir modificadores si existen.
  if (item.modifierNames && item.modifierNames.length > 0) {
    summary += `  ${item.modifierNames.join(", ")}\n`;
  }

  // Añadir personalizaciones de pizza si existen.
  if (item.pizzaCustomizationDetails && item.pizzaCustomizationDetails.length > 0) {
    summary += formatPizzaCustomizations(item.pizzaCustomizationDetails);
  }

  // Añadir comentarios si existen.
  if (item.comments) {
    summary += `  Nota: ${item.comments}\n`;
  }

  return summary;
}

/**
 * Genera el resumen completo de un pedido para enviar por WhatsApp.
 */
export function generateOrderSummary(order: {
  orderType: OrderType | string;
  deliveryInfo?: any;
  items: CalculatedOrderItem[];
  total: number;
  estimatedDeliveryTime?: number;
  scheduledAt?: Date;
}): string {
  // Convertir a OrderType si viene como string para mantener compatibilidad
  const orderTypeEnum = order.orderType as OrderType;
  const deliveryTypeText = orderTypeEnum === OrderType.DELIVERY ? "Entrega a domicilio" : "Recolección";

  let message = `📋 *Resumen de tu pedido:*\n\n`;
  message += `📦 *Tipo de orden:* ${deliveryTypeText}\n\n`;

  if (order.deliveryInfo) {
    const info = order.deliveryInfo;
    
    // Para órdenes de recolección, mostrar el nombre del cliente
    if (orderTypeEnum === OrderType.TAKE_AWAY && info.recipientName) {
      message += `👤 *Cliente:* ${info.recipientName}\n\n`;
    }
    
    // Para órdenes de delivery, mostrar solo la dirección
    if (orderTypeEnum === OrderType.DELIVERY) {
      message += `📍 *Dirección de entrega:*\n`;
      if (info.name) message += `${info.name}\n`; // Nombre de la dirección (Casa, Oficina, etc)
      message += `${info.street} ${info.number || ''}${info.interiorNumber ? ` Int. ${info.interiorNumber}` : ''}\n`;
      if (info.neighborhood) message += `Col. ${info.neighborhood}\n`;
      if (info.deliveryInstructions) message += `Ref: ${info.deliveryInstructions}\n`;
      message += "\n";
    }
  }

  message += `🛒 *Productos:*\n`;
  order.items.forEach(item => {
    // Aquí es importante asegurarse de que el `item` que se pasa
    // tenga la estructura de `CalculatedOrderItem`.
    message += generateProductSummary(item);
  });

  message += `\n💰 *Total: $${order.total.toFixed(2)}*\n`;

  if (order.estimatedDeliveryTime) {
    message += `\n⏱️ *Tiempo estimado:* ${order.estimatedDeliveryTime} minutos\n`;
  }

  if (order.scheduledAt) {
    const date = new Date(order.scheduledAt);
    const formattedTime = date.toLocaleTimeString(env.DEFAULT_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
    });
    message += `\n⏰ *Programado para:* Hoy a las ${formattedTime}\n`;
  }

  message += `\n📝 Por favor, confirma si tu pedido es correcto.`;
  
  return message;
}